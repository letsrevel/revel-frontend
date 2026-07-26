<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { memembershipapplicationsGetJoinEligibility } from '$lib/api/generated/sdk.gen';
	import type {
		MembershipEligibilitySchema,
		MembershipStatus,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		getMembershipCtaKind,
		getMembershipStatusMessage
	} from '$lib/utils/membership-eligibility';
	import RetryCountdown from '$lib/components/events/RetryCountdown.svelte';
	import ApplyDialog from './ApplyDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Award, Check, ClipboardList, Clock, Crown, Shield, UserPlus } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { resolve } from '$app/paths';

	interface Props {
		organizationSlug: string;
		organizationName: string;
		isAuthenticated: boolean;
		/** From the server-rendered page; the eligibility verdict can also say so. */
		isMember?: boolean;
		membershipTier?: MembershipTierSchema | null;
		membershipStatus?: MembershipStatus | null;
		isOwner?: boolean;
		isStaff?: boolean;
		class?: string;
	}

	const {
		organizationSlug,
		organizationName,
		isAuthenticated,
		isMember = false,
		membershipTier = null,
		membershipStatus = null,
		isOwner = false,
		isStaff = false,
		class: className
	}: Props = $props();

	// Status badge styling, kept in step with MemberCard.svelte.
	const statusStyles: Record<MembershipStatus, string> = {
		active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
		paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
		cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
		banned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
	};

	const accessToken = $derived(authStore.accessToken);

	// Every operand is read unconditionally: `&&`/`||` inside a `$derived` would
	// short-circuit, leaving the skipped signal untracked by the query options.
	const hasServerVerdict = $derived.by(() => {
		const owner = isOwner;
		const staff = isStaff;
		const member = isMember;
		return owner || staff || member;
	});

	// The badge branches answer the question on their own — asking the backend
	// would be a wasted round trip on every org page an owner visits.
	const queryEnabled = $derived.by(() => {
		const authed = isAuthenticated;
		const settled = hasServerVerdict;
		const token = !!accessToken;
		return authed && !settled && token;
	});

	const eligibilityQuery = createQuery(() => ({
		queryKey: ['org', organizationSlug, 'join-eligibility'],
		queryFn: async (): Promise<MembershipEligibilitySchema> => {
			const res = await memembershipapplicationsGetJoinEligibility({
				path: { slug: organizationSlug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error('Failed to load membership eligibility');
			}
			return res.data;
		},
		enabled: queryEnabled,
		retry: false
	}));

	const eligibility = $derived(eligibilityQuery.data ?? null);
	const ctaKind = $derived(eligibility ? getMembershipCtaKind(eligibility) : null);

	const loginHref = $derived(
		`${resolve('/(public)/login', {})}?returnUrl=${encodeURIComponent(
			resolve('/(public)/org/[slug]', { slug: organizationSlug })
		)}`
	);

	const membershipsHref = resolve('/(auth)/account/memberships', {});

	const questionnaireHref = $derived.by(() => {
		const id = eligibility?.questionnaire_id;
		if (!id) return null;
		return resolve('/(public)/org/[slug]/questionnaire/[id]', { slug: organizationSlug, id });
	});

	let applyOpen = $state(false);
	let applyMode = $state<'join' | 'reapply'>('join');

	function openApply(mode: 'join' | 'reapply'): void {
		applyMode = mode;
		applyOpen = true;
	}
</script>

{#snippet memberBadge()}
	<!-- Ported from the legacy RequestMembershipButton: status pill + tier pill,
	     each labelled by its own text so nothing is conveyed by colour alone. -->
	<div class={cn('inline-flex flex-wrap items-center gap-2', className)} role="status">
		{#if membershipStatus}
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium {statusStyles[
					membershipStatus
				]}"
				aria-label={m['membershipEligibility.memberStatusAriaLabel']({
					status: m[`memberStatus.${membershipStatus}`]()
				})}
			>
				<Check class="h-3 w-3" aria-hidden="true" />
				{m[`memberStatus.${membershipStatus}`]()}
			</span>
		{/if}

		{#if membershipTier}
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100"
				aria-label={m['membershipEligibility.memberTierAriaLabel']({ tier: membershipTier.name })}
			>
				<Award class="h-3 w-3" aria-hidden="true" />
				{membershipTier.name}
			</span>
		{:else if !membershipStatus}
			<!-- Eligibility-derived membership: no server props to describe it. -->
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100"
				aria-label={m['membershipEligibility.memberBadgeAriaLabel']()}
			>
				<Check class="h-3 w-3" aria-hidden="true" />
				{m['membershipEligibility.memberBadge']()}
			</span>
		{/if}
	</div>
{/snippet}

{#if isOwner}
	<div
		class={cn(
			'inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary dark:border-primary dark:bg-primary/20',
			className
		)}
		role="status"
		aria-label={m['membershipEligibility.ownerBadgeAriaLabel']()}
	>
		<Crown class="h-4 w-4" aria-hidden="true" />
		{m['membershipEligibility.ownerBadge']()}
	</div>
{:else if isStaff}
	<div
		class={cn(
			'inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
			className
		)}
		role="status"
		aria-label={m['membershipEligibility.staffBadgeAriaLabel']()}
	>
		<Shield class="h-4 w-4" aria-hidden="true" />
		{m['membershipEligibility.staffBadge']()}
	</div>
{:else if isMember}
	{@render memberBadge()}
{:else if !isAuthenticated}
	<!-- A real link, not a scripted redirect: it survives no-JS, middle-click and
	     the browser's own "open in new tab". SvelteKit routes it client-side. -->
	<Button href={loginHref} class={className}>
		<UserPlus class="h-4 w-4" aria-hidden="true" />
		{m['membershipEligibility.join']({ orgName: organizationName })}
	</Button>
{:else if eligibility && ctaKind}
	<div class={cn('flex flex-col items-start gap-2', className)}>
		{#if ctaKind === 'join'}
			<Button onclick={() => openApply('join')}>
				<UserPlus class="h-4 w-4" aria-hidden="true" />
				{m['membershipEligibility.join']({ orgName: organizationName })}
			</Button>
		{:else if ctaKind === 'reapply'}
			<Button onclick={() => openApply('reapply')}>
				<UserPlus class="h-4 w-4" aria-hidden="true" />
				{m['membershipEligibility.reapply']()}
			</Button>
		{:else if ctaKind === 'questionnaire' && questionnaireHref}
			<!-- Button-styled, but left as a link: `role="button"` would demand a
			     Space-key handler the anchor does not have. -->
			<Button href={questionnaireHref}>
				<ClipboardList class="h-4 w-4" aria-hidden="true" />
				{m['membershipEligibility.questionnaireCta']()}
			</Button>
		{:else if ctaKind === 'waiting'}
			<Button variant="secondary" disabled>
				<Clock class="h-4 w-4" aria-hidden="true" />
				{m['membershipEligibility.waiting']()}
			</Button>
			<a
				href={membershipsHref}
				class="text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				{m['membershipEligibility.trackApplication']()}
			</a>
		{:else if ctaKind === 'retry_later'}
			<Button variant="secondary" disabled>
				{m['membershipEligibility.questionnaireCta']()}
			</Button>
			{#if eligibility.retry_on}
				<RetryCountdown retryOn={eligibility.retry_on} class="text-muted-foreground" />
			{/if}
		{:else if ctaKind === 'member'}
			{@render memberBadge()}
		{:else}
			<!-- `info`, plus the questionnaire verdict with no questionnaire to
			     point at: nothing to do here, so say why. -->
			<p role="note" class="text-sm text-muted-foreground">
				{getMembershipStatusMessage(eligibility)}
			</p>
		{/if}
	</div>
{/if}

<!--
	Deliberately outside the whole chain above, not just the ctaKind branches: a
	completed application calls `invalidateAll()`, the reloaded page reports
	`isMember`, and the chain switches to the member badge. Rendered inside, the
	dialog would be destroyed mid-read — an unannounced context change that drops
	focus to <body> (WCAG 3.2). Here the badge simply appears behind it, and the
	dialog lives until the user closes it. Its own `open` state is the only gate;
	nothing outside the CTA branches can set it.
-->
<ApplyDialog
	open={applyOpen}
	onOpenChange={(next) => (applyOpen = next)}
	{organizationSlug}
	{organizationName}
	mode={applyMode}
/>
