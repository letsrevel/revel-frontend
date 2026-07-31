<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import type { MembershipStatus, MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { joinEligibilityQueryOptions } from '$lib/queries/join-eligibility';
	import {
		getMembershipCtaKind,
		getMembershipStatusMessage
	} from '$lib/utils/membership-eligibility';
	import RetryCountdown from '$lib/components/events/RetryCountdown.svelte';
	import ApplyDialog from './ApplyDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Award,
		Check,
		ClipboardList,
		Clock,
		CreditCard,
		Crown,
		RefreshCw,
		Shield,
		UserPlus
	} from '@lucide/svelte';
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
		/**
		 * The tier this CTA asks about.
		 *
		 * Present → *tier mode*: the verdict is resolved against that tier (its own
		 * questionnaire/approval overrides, not just the org defaults) and joining
		 * posts the tier, so the application is no longer tier-less.
		 *
		 * Absent → *summary mode*, for surfaces that stand outside the tier grid
		 * (the org landing hero). There every actionable verdict becomes a link to
		 * `/org/[slug]/membership`, because there is no honest way to apply without
		 * first choosing a tier — that is exactly the hole #720 exists to close.
		 */
		tierId?: string | null;
		/** Names the tier in the CTA, so N cards do not all read "Join". */
		tierName?: string | null;
		/**
		 * A representative plan of this tier, which changes what the backend is
		 * ASKED — and on a monetized tier it is the only way to get an answer worth
		 * rendering (#735).
		 *
		 * Without it, gate #6 (`TierAvailabilityGate`) short-circuits any tier
		 * carrying an active plan with `tier_requires_subscription` and no
		 * `next_step`, so the CTA rendered the org's policy prose and offered
		 * nothing — the approval gate below it never even ran. With it the verdict
		 * names a move (`submit_application`, `submit_questionnaire`,
		 * `wait_for_approval`, `proceed_to_payment`, …).
		 *
		 * `TierCard` supplies it, and only for a GATED tier, so an ungated paid
		 * tier's CTA is untouched. It is the same plan the tier's plan cards are
		 * gated on, and the query options are shared — so this is the SAME cache
		 * key and one request, not a second round trip per tier.
		 */
		planId?: string | null;
		/**
		 * Tier mode only: this tier's plans are on screen next to the CTA, so a
		 * `proceed_to_payment` verdict points at them instead of linking away.
		 */
		plansInline?: boolean;
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
		class: className,
		tierId = null,
		tierName = null,
		planId = null,
		plansInline = false
	}: Props = $props();

	const isTierMode = $derived(!!tierId);

	/**
	 * The verdict was asked WITH a plan and that tier's plan cards are on screen,
	 * so every step it names that is per-plan — apply, re-apply, pay — belongs to
	 * those cards, which carry the plan's id and its name. This CTA points at them
	 * instead of offering a second, plan-less copy of the same button (#735).
	 *
	 * Gated on `planId` rather than on `plansInline` alone: a tier whose plans are
	 * all offline still renders plan cards but gets no plan-bearing verdict, and
	 * its CTA must keep behaving exactly as it did.
	 */
	const deferToPlans = $derived.by(() => {
		// Both operands read unconditionally: `&&` inside a `$derived` would leave
		// the skipped one untracked.
		const plan = !!planId;
		const inline = plansInline;
		return plan && inline;
	});

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

	// The tier is part of the key, not just the request: verdicts are per tier
	// (one may be joinable while its neighbour wants a questionnaire) and a
	// shared key would serve whichever card asked first to all of them. The
	// existing `['org', slug, 'join-eligibility']` invalidations still reach
	// every entry — TanStack matches keys by prefix.
	const eligibilityQuery = createQuery(() =>
		joinEligibilityQueryOptions({
			organizationSlug,
			tierId,
			planId,
			accessToken,
			enabled: queryEnabled
		})
	);

	const eligibility = $derived(eligibilityQuery.data ?? null);
	const ctaKind = $derived(eligibility ? getMembershipCtaKind(eligibility) : null);

	// `isPending`, not `isLoading` — same distinction as
	// `routes/(auth)/account/memberships/+page.svelte`: a query that is still
	// *disabled* reports `isLoading === false`, and `queryEnabled` stays false for
	// the whole SSR + client-auth-bootstrap window (`accessToken` is null there).
	// Gating the placeholder on `isLoading` would therefore leave the CTA slot
	// empty in the server HTML and through hydration — exactly the hole this
	// branch exists to fill — and only start it once the request was already in
	// flight. `isPending` covers disabled-and-never-fetched too, so the skeleton
	// is on screen from first paint until the verdict lands.
	//
	// The trade-off is the mirror of that file's: a user the server says is
	// authenticated whose token never arrives keeps the skeleton forever. Here
	// `isAuthenticated` comes from the server-rendered page data (guests are
	// caught by the branch above and never reach this one), so the only way to
	// sit here is a bootstrap that genuinely has not finished yet.
	const isVerdictPending = $derived(eligibilityQuery.isPending);

	// A cached failure must not outlive the question. If the props flip to
	// member/staff/owner (an accepted application calls `invalidateAll()`), the
	// chain switches to a badge and the stale error line would contradict it.
	const showLoadError = $derived.by(() => {
		const failed = eligibilityQuery.isError;
		const authed = isAuthenticated;
		const settled = hasServerVerdict;
		return failed && authed && !settled;
	});

	/** The tier grid: where a membership is actually chosen. */
	const membershipHref = $derived(
		resolve('/(public)/org/[slug]/membership', { slug: organizationSlug })
	);

	// Tier mode only, and it comes back to the grid rather than the org landing
	// page: the login round trip exists so the visitor can press Join on a tier,
	// so it must return them to where that button is.
	const loginHref = $derived(
		`${resolve('/(public)/login', {})}?returnUrl=${encodeURIComponent(membershipHref)}`
	);

	/** The label a join button carries: the tier when there is one, else the org. */
	const joinLabel = $derived(
		tierName
			? m['membershipEligibility.joinTier']({ tier: tierName })
			: m['membershipEligibility.join']({ orgName: organizationName })
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
	     the browser's own "open in new tab". SvelteKit routes it client-side.
	     Summary mode sends the visitor to the tier grid rather than straight to
	     login: the grid is public, so they get to see what they would be joining
	     before being asked for an account. -->
	<Button href={isTierMode ? loginHref : membershipHref} class={className}>
		<UserPlus class="h-4 w-4" aria-hidden="true" />
		{joinLabel}
	</Button>
{:else if eligibility && ctaKind}
	<div class={cn('flex flex-col items-start gap-2', className)}>
		{#if ctaKind === 'apply' || (deferToPlans && (ctaKind === 'join' || ctaKind === 'reapply'))}
			<!-- #735. The gates are waiting on an application, and on a monetized
			     tier an application has to name a plan or the backend refuses it —
			     so the affordance lives on the plan cards, one per plan, and this
			     says where to look and what happens next. `role="note"`, the same
			     shape the `payment` branch already uses for the same reason. -->
			{#if deferToPlans}
				<p role="note" class="text-sm text-muted-foreground">
					{m['membershipEligibility.applyChoosePlan']()}
				</p>
			{:else}
				<!-- No plan on this CTA, so it cannot mint the paid application the
				     verdict is asking for: send them to the grid, where the plan cards
				     can. Unreachable in practice — `submit_application` is emitted by
				     the payment gate, which only runs for a plan-bearing question. -->
				<Button href={membershipHref}>
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					{m['membershipPlans.viewMembership']()}
				</Button>
			{/if}
		{:else if ctaKind === 'join'}
			{#if isTierMode}
				<Button onclick={() => openApply('join')}>
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					{joinLabel}
				</Button>
			{:else}
				<!-- Summary mode: applying from here would create the tier-less
				     application #720 is about, so it offers the grid instead. -->
				<Button href={membershipHref}>
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					{m['membershipPlans.viewMembership']()}
				</Button>
			{/if}
		{:else if ctaKind === 'reapply'}
			{#if isTierMode}
				<Button onclick={() => openApply('reapply')}>
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					{m['membershipEligibility.reapply']()}
				</Button>
			{:else}
				<Button href={membershipHref}>
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					{m['membershipEligibility.reapply']()}
				</Button>
			{/if}
		{:else if ctaKind === 'payment'}
			<!-- Every gate is cleared and only the charge is left. With the tier's
			     plans on screen the CTA is one of those cards, so this says so in
			     words; anywhere else it links to where they live. -->
			{#if plansInline}
				<p role="note" class="text-sm text-muted-foreground">
					{m['membershipEligibility.choosePlan']()}
				</p>
			{:else}
				<Button href={membershipHref}>
					<CreditCard class="h-4 w-4" aria-hidden="true" />
					{m['membershipPlans.viewMembership']()}
				</Button>
			{/if}
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
{:else if isVerdictPending}
	<!-- Purely decorative: sized like the default Button (h-10) so the verdict
	     lands without shifting the header, and `aria-hidden` so screen readers are
	     not told about a box with no content. The failure and success states both
	     announce themselves, so nothing is lost by staying silent here. -->
	<div
		class={cn('h-10 w-40 max-w-full animate-pulse rounded-md bg-muted', className)}
		aria-hidden="true"
	></div>
{/if}

<!--
	Pre-mounted polite live region (WCAG 2.1 AA §4.1.3), same house pattern as
	ChangePlanDialog: the failure replaces the placeholder without moving focus,
	so it would otherwise never be announced — and a live region injected together
	with its first message is not observed by assistive tech and stays silent. The
	wrapper therefore lives outside the chain and is `empty:hidden` until it has
	something to say.

	`retry: false` on the query is deliberate (a rejected verdict is a decision,
	not a blip, and silent retries would hammer the endpoint on every org page),
	so this button is the whole recovery path — without it the join CTA never
	comes back short of a full page reload.
-->
<div aria-live="polite" class="empty:hidden">
	{#if showLoadError}
		<div class={cn('flex flex-col items-start gap-2', className)}>
			<p class="text-sm font-medium text-destructive">
				{m['membershipEligibility.loadError']()}
			</p>
			<!-- Not disabled while the retry is in flight: unlike ChangePlanDialog's
			     footer this button is not inside a focus trap, so disabling the very
			     control the user just activated would drop focus to <body> (WCAG 2.4.3).
			     The spinning icon carries the busy state instead, and TanStack collapses
			     an impatient double-click into one in-flight request. -->
			<Button variant="outline" size="sm" onclick={() => void eligibilityQuery.refetch()}>
				<RefreshCw
					class={cn('h-4 w-4', eligibilityQuery.isFetching && 'animate-spin')}
					aria-hidden="true"
				/>
				{m['membershipEligibility.retryLoad']()}
			</Button>
		</div>
	{/if}
</div>

<!--
	Deliberately outside the whole chain above, not just the ctaKind branches: a
	completed application calls `invalidateAll()`, the reloaded page reports
	`isMember`, and the chain switches to the member badge. Rendered inside, the
	dialog would be destroyed mid-read — an unannounced context change that drops
	focus to <body> (WCAG 3.2). Here the badge simply appears behind it, and the
	dialog lives until the user closes it. Its own `open` state is the only gate;
	nothing outside the CTA branches can set it.

	Summary mode never opens it — there is no tier to apply to from there — so it
	is not mounted at all, rather than mounted and unreachable.
-->
{#if isTierMode}
	<ApplyDialog
		open={applyOpen}
		onOpenChange={(next) => (applyOpen = next)}
		{organizationSlug}
		{organizationName}
		{tierId}
		{tierName}
		{planId}
		mode={applyMode}
	/>
{/if}
