<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { CalendarX, Loader2, Mail, Pencil, Trash2, UserCog } from '@lucide/svelte';
	import { organizationadminmembersListMembers } from '$lib/api/generated/sdk.gen';
	import type { MembershipRecordSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import MemberAccessActions from '$lib/components/members/MemberAccessActions.svelte';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel } from '$lib/member-register/badges';
	import { getEditability } from '$lib/member-register/editability';
	import { findMemberByUserId } from '$lib/member-register/find-member';
	import { canManageMember } from '$lib/member-register/people-view';

	interface Props {
		record: MembershipRecordSchema;
		slug: string;
		accessToken: string | null | undefined;
		tiers: MembershipTierSchema[];
		isStaff: boolean;
		isOwner: boolean;
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
		onEdit,
		onEnd,
		onDelete,
		onInvite
	}: Props = $props();

	// The member actions (change tier, pause / resume, remove, ban) exist only for
	// a linked, current standard entry: nothing else has a live access row.
	const manageable = $derived(canManageMember(record));
	const merged = $derived(!!record.merged_into_id);

	// The access row, found by the entry's USER id (the member list cannot filter by it).
	const memberQuery = createQuery(() => ({
		queryKey: ['organization', slug, 'members', 'by-user', record.user_id ?? ''],
		queryFn: () =>
			findMemberByUserId(record, async (term) => {
				const response = await organizationadminmembersListMembers({
					path: { slug },
					query: { search: term, page_size: 100 },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to fetch members');
				return response.data?.results ?? [];
			}),
		enabled: !!accessToken && manageable
	}));
	const member = $derived(memberQuery.data ?? null);

	let manageOpen = $state(false);

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

	{#if manageable}
		<div class="space-y-2" data-testid="person-member-actions">
			<p class="text-sm text-muted-foreground">{m['memberPeople.sheet.manageHelp']()}</p>
			{#if memberQuery.isError || (memberQuery.isSuccess && !member)}
				<p class="text-sm text-destructive" role="alert">
					{m['memberPeople.sheet.memberLoadError']()}
				</p>
			{/if}
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
		</div>
		<MemberAccessActions
			{slug}
			{accessToken}
			{member}
			{tiers}
			{isStaff}
			open={manageOpen}
			onClose={() => (manageOpen = false)}
		/>
	{:else if !merged}
		<div class="space-y-3" data-testid="person-register-actions">
			<p class="text-sm text-muted-foreground">{unlinkedHint}</p>
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
