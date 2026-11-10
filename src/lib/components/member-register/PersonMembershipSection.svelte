<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { CalendarX, Loader2, Mail, Pencil, Trash2, UserCog } from '@lucide/svelte';
	import type {
		MembershipRecordSchema,
		MembershipTierSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import MemberAccessActions from '$lib/components/members/MemberAccessActions.svelte';
	import PersonSubscriptionActions from './PersonSubscriptionActions.svelte';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel } from '$lib/member-register/badges';
	import { getEditability } from '$lib/member-register/editability';
	import { fetchMemberAccess, memberAccessKey } from '$lib/member-register/member-access';
	import { canManageMember } from '$lib/member-register/people-view';

	interface Props {
		record: MembershipRecordSchema;
		slug: string;
		accessToken: string | null | undefined;
		tiers: MembershipTierSchema[];
		isStaff: boolean;
		isOwner: boolean;
		/** Needed for the subscription drawer and create modal. */
		organization?: OrganizationAdminDetailSchema | null;
		/** The viewer holds `manage_subscriptions`. */
		canManageSubscriptions?: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
	}

	const {
		record,
		slug,
		accessToken,
		tiers,
		isStaff,
		isOwner,
		organization = null,
		canManageSubscriptions = false,
		onEdit,
		onEnd,
		onDelete,
		onInvite
	}: Props = $props();

	// A linked, current standard entry always has a live access row; the access
	// row itself is what decides whether member actions exist (see below).
	const manageable = $derived(canManageMember(record));
	const merged = $derived(!!record.merged_into_id);

	// The person's access row in ANY status (a cancelled or banned member keeps
	// one, and staff can reactivate it). A 404 is "no access row": no member
	// actions. Any other failure throws, so TanStack retries. The key sits outside
	// the members-list prefix (a note save must not refetch it).
	const memberQuery = createQuery(() => ({
		queryKey: memberAccessKey(slug, record.user_id ?? ''),
		queryFn: () => fetchMemberAccess(slug, accessToken, record.user_id as string),
		enabled: !!accessToken && !!record.user_id && !merged
	}));
	const member = $derived(memberQuery.data ?? null);
	const showManage = $derived(!!member || (manageable && !memberQuery.isSuccess));
	// No access row (404) means no member actions: even a current entry then falls
	// back to the plain register actions.
	// Register actions (edit / end / delete) stay out of the way of a live member:
	// the member actions end the entry themselves.
	const showRegisterActions = $derived(
		!merged && (!manageable || (memberQuery.isSuccess && !member))
	);

	let manageOpen = $state(false);
	let subscriptionActions = $state<{ openManage: () => void } | null>(null);
	// Account-less register entries have no member row, hence no subscription.
	const showSubscription = $derived(
		canManageSubscriptions && !!organization && !!record.user_id && !!member
	);

	const canEnd = $derived(getEditability(record).canEnd);
	const unlinkedHint = $derived(
		record.kind === 'temporary'
			? m['memberPeople.sheet.noAccessDay']()
			: !record.has_account
				? m['memberPeople.sheet.noAccessUnlinked']()
				: m['memberPeople.sheet.noAccessNotCurrent']()
	);
</script>

<section
	aria-labelledby="person-membership-heading"
	class="space-y-3"
	data-testid="person-membership"
>
	<SectionHeader
		id="person-membership-heading"
		level={3}
		title={m['memberPeople.sheet.membershipHeading']()}
	/>

	<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
		<div>
			<dt class="text-xs text-muted-foreground">{m['memberRegister.colTier']()}</dt>
			<dd>{record.tier_name || '-'}</dd>
		</div>
		<div>
			<dt class="text-xs text-muted-foreground">{m['memberRegister.colKind']()}</dt>
			<dd>{kindLabel(record.kind)}</dd>
		</div>
		<div>
			<dt class="text-xs text-muted-foreground">{m['memberPeople.sheet.since']()}</dt>
			<dd>{formatDate(record.valid_from)}</dd>
		</div>
	</dl>

	{#if showManage}
		<div class="space-y-2" data-testid="person-member-actions">
			<p class="text-sm text-muted-foreground">{m['memberPeople.sheet.manageHelp']()}</p>
			{#if member?.status === 'banned'}
				<p class="text-sm" data-testid="person-banned-hint">
					{m['memberPeople.sheet.bannedHint']()}
					<a
						class="font-medium underline underline-offset-4"
						href={resolve('/(auth)/org/[slug]/admin/blacklist', { slug })}
					>
						{m['memberPeople.sheet.bannedLink']()}
					</a>
				</p>
			{/if}
			{#if memberQuery.isError}
				<p class="text-sm text-destructive" role="alert">
					{m['memberPeople.sheet.memberLoadError']()}
				</p>
			{/if}
			<div class="flex flex-wrap gap-2">
				<Button
					onclick={() => (manageOpen = true)}
					disabled={!member}
					data-testid="person-manage-membership"
				>
					{#if memberQuery.isPending}
						<Loader2 class="animate-spin" aria-hidden="true" />
					{:else}
						<UserCog aria-hidden="true" />
					{/if}
					{m['memberPeople.sheet.manage']()}
				</Button>
				{#if showSubscription && organization && member}
					<PersonSubscriptionActions
						bind:this={subscriptionActions}
						{organization}
						{accessToken}
						{member}
					/>
				{/if}
			</div>
		</div>
		<MemberAccessActions
			{slug}
			{accessToken}
			{member}
			{tiers}
			{isStaff}
			open={manageOpen}
			onClose={() => (manageOpen = false)}
			onManageSubscription={showSubscription ? () => subscriptionActions?.openManage() : undefined}
		/>
	{/if}
	{#if showRegisterActions}
		<div class="space-y-3" data-testid="person-register-actions">
			{#if !member}
				<p class="text-sm text-muted-foreground">{unlinkedHint}</p>
			{/if}
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" onclick={() => onEdit(record)}>
					<Pencil aria-hidden="true" />
					{m['memberRegister.actionEdit']()}
				</Button>
				{#if record.can_invite}
					<Button variant="outline" onclick={() => onInvite(record)}>
						<Mail aria-hidden="true" />
						{record.invite_status === 'invited'
							? m['memberRegister.actionResendInvite']()
							: m['memberRegister.actionInvite']()}
					</Button>
				{/if}
				{#if canEnd}
					<Button variant="outline" onclick={() => onEnd(record)}>
						<CalendarX aria-hidden="true" />
						{m['memberRegister.actionEnd']()}
					</Button>
				{/if}
				{#if isOwner}
					<Button variant="outline" class="text-destructive" onclick={() => onDelete(record)}>
						<Trash2 aria-hidden="true" />
						{m['memberRegister.actionDelete']()}
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</section>
