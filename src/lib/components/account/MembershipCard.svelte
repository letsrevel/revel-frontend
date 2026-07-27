<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import {
		mesubscriptionsCreateBillingPortalSession,
		mesubscriptionsSubscribe,
		organizationListMembershipPlans
	} from '$lib/api/generated/sdk.gen';
	import type { MyMembershipSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/members/StatusBadge.svelte';
	import CancelSubscriptionDialog from './subscription-actions/CancelSubscriptionDialog.svelte';
	import ChangePlanDialog from './subscription-actions/ChangePlanDialog.svelte';
	import { formatPlanPrice, getDateLine, getMemberActions } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		membership: MyMembershipSchema;
	}

	const { membership }: Props = $props();
	const sub = $derived(membership.subscription);
	const line = $derived(sub ? getDateLine(sub) : null);
	const accessToken = $derived(authStore.accessToken);

	// Single source of truth for what a member may do here — never re-derive
	// status/payment-method logic inline.
	const actions = $derived(sub ? getMemberActions(sub) : null);
	const isOffline = $derived(sub?.plan.payment_method === 'offline');

	let cancelOpen = $state(false);
	let changePlanOpen = $state(false);
	// Set on success and never cleared: the browser is on its way to Stripe, so
	// the button must stay in its loading state until the page is replaced. One
	// latch per destination — the portal and the resumed Checkout are different
	// buttons on different statuses.
	let redirecting = $state(false);
	let resuming = $state(false);

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}

	// Both halves are asserted positively rather than as each other's negation,
	// so a third payment method would render neither surface instead of the wrong one.
	/** Amber banner only where the member can actually fix the payment themselves. */
	const pastDueOnline = $derived(
		sub?.status === 'past_due' && sub?.plan.payment_method === 'online'
	);

	/**
	 * A queued plan change takes effect at the end of the paid period, so the
	 * line only makes sense once we know that date — otherwise it is omitted.
	 * The catalogue is fetched lazily and shares ChangePlanDialog's cache key.
	 */
	const plansQuery = createQuery(() => ({
		queryKey: ['org', membership.organization_slug, 'membership-plans'],
		queryFn: async () => {
			const res = await organizationListMembershipPlans({
				path: { slug: membership.organization_slug }
			});
			// The endpoint returns a bare array (no pagination envelope).
			if (res.error || !res.data) throw new Error(m['changePlan.loadError']());
			return res.data;
		},
		enabled: !!sub?.pending_plan_id
	}));

	const pendingSwitch = $derived.by(() => {
		const pendingPlanId = sub?.pending_plan_id;
		const periodEnd = sub?.current_period_end;
		if (!pendingPlanId || !periodEnd) return null;
		const name =
			(plansQuery.data ?? []).find((p) => p.id === pendingPlanId)?.name ??
			m['orgPublic.yourMembership.pendingSwitchFallbackPlan']();
		return m['orgPublic.yourMembership.pendingSwitch']({
			plan: name,
			date: formatDate(periodEnd)
		});
	});

	const portalMutation = createMutation(() => ({
		mutationFn: async () => {
			const current = sub;
			if (!current) throw new Error(m['subscriptions.actions.portalError']());
			const res = await mesubscriptionsCreateBillingPortalSession({
				path: { org_id: current.organization_id },
				// Stripe sends the member back to the card they started from.
				body: { return_url: window.location.href },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscriptions.actions.portalError']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			redirecting = true;
			// The hosted portal lives on another origin, so this is a real document
			// navigation, not a SvelteKit one.
			window.location.href = data.url;
		},
		onError: (err: Error) => {
			toast.error(err.message || m['subscriptions.actions.portalError']());
		}
	}));

	// Both operands are read unconditionally: a short-circuiting `||` would skip
	// `redirecting` whenever the mutation is still pending, leaving it untracked.
	const portalBusy = $derived.by(() => {
		const pending = portalMutation.isPending;
		const goingToPortal = redirecting;
		return pending || goingToPortal;
	});

	/**
	 * #694 — walk a PENDING row back to its abandoned hosted Checkout. Subscribing
	 * again with the row's OWN plan is the resume: the backend's
	 * `_maybe_resume_pending_checkout` recognises the open session for that plan
	 * and hands the same URL back instead of opening a second one. Same mechanism
	 * CheckoutReturnCard uses on the org page.
	 */
	const resumeMutation = createMutation(() => ({
		mutationFn: async () => {
			const current = sub;
			if (!current) throw new Error(m['subscriptions.actions.resumeError']());
			const res = await mesubscriptionsSubscribe({
				path: { org_id: current.organization_id },
				body: { plan_id: current.plan_id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscriptions.actions.resumeError']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			resuming = true;
			// Hosted Stripe Checkout is another origin: a real document navigation.
			window.location.href = data.checkout_url;
		},
		onError: (err: Error) => {
			toast.error(err.message || m['subscriptions.actions.resumeError']());
		}
	}));

	// Same unconditional read as `portalBusy`, and latched for the same reason:
	// the document is on its way to Stripe.
	const resumeBusy = $derived.by(() => {
		const pending = resumeMutation.isPending;
		const goingToStripe = resuming;
		return pending || goingToStripe;
	});
</script>

<Card>
	<CardContent class="p-4">
		<article aria-label={membership.organization_name}>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="font-semibold">{membership.organization_name}</h3>
					{#if sub}
						<p class="text-sm text-muted-foreground">
							{sub.plan.name} · {formatPlanPrice(sub.plan)}
						</p>
					{:else if membership.tier}
						<p class="text-sm text-muted-foreground">{membership.tier.name}</p>
					{/if}
				</div>
				{#if sub}
					<StatusBadge status={sub.status} />
				{:else}
					<Badge variant="secondary" class="capitalize">{membership.status}</Badge>
				{/if}
			</div>

			{#if sub && line}
				{#if pastDueOnline}
					<p
						role="alert"
						class="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-100"
					>
						{#if sub.grace_deadline}
							{m['subscriptions.pastDue.bannerDated']({ date: formatDate(sub.grace_deadline) })}
						{:else}
							{m['subscriptions.pastDue.banner']()}
						{/if}
					</p>
				{/if}

				<p class="mt-2 text-sm">
					{#if line.kind === 'renewal'}
						{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'cancels'}
						{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'period_ends'}
						{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'paused_since'}
						{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'ended'}
						{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
					{:else if line.kind === 'pending'}
						{m['subscriptions.dateLine.pending']()}
					{/if}
				</p>

				{#if line.kind === 'cancels'}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['subscriptions.cancelScheduledHint']()}
					</p>
				{/if}

				{#if pendingSwitch}
					<p class="mt-1 text-sm text-muted-foreground">{pendingSwitch}</p>
				{/if}

				<!-- OFFLINE subscriptions are staff-run: say so instead of offering
				     buttons the backend would refuse. -->
				{#if isOffline}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['account.memberships.managedBy']({ org: membership.organization_name })}
					</p>
					{#if sub.status === 'past_due'}
						<p class="mt-1 text-xs text-muted-foreground">
							{m['account.memberships.contactOrg']()}
						</p>
					{/if}
				{/if}
			{:else}
				<p class="mt-2 text-sm text-muted-foreground">
					{m['account.memberships.memberSince']({ date: fmtDate(membership.member_since) })}
				</p>
			{/if}

			<div class="mt-3 flex flex-wrap gap-2">
				<Button href="/org/{membership.organization_slug}" variant="outline" size="sm">
					{m['account.memberships.viewOrg']()}
				</Button>
				{#if actions?.manageBilling}
					<Button size="sm" onclick={() => portalMutation.mutate()} disabled={portalBusy}>
						{#if portalBusy}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{/if}
						{m['subscriptions.actions.manageBilling']()}
					</Button>
				{/if}
				{#if actions?.resumePayment}
					<Button
						size="sm"
						onclick={() => resumeMutation.mutate()}
						disabled={resumeBusy}
						aria-busy={resumeBusy}
					>
						{#if resumeBusy}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{/if}
						{m['subscriptions.actions.resumePayment']()}
					</Button>
				{/if}
				{#if actions?.changePlan}
					<Button variant="outline" size="sm" onclick={() => (changePlanOpen = true)}>
						{m['subscriptions.actions.changePlan']()}
					</Button>
				{/if}
				{#if actions?.cancel}
					<Button variant="ghost" size="sm" onclick={() => (cancelOpen = true)}>
						{m['subscriptions.actions.cancel']()}
					</Button>
				{/if}
			</div>
		</article>
	</CardContent>
</Card>

<!--
	Deliberately outside the status chain and the action row above: both dialogs
	rewrite `['me', 'memberships']` on success (`settleSubscriptionCaches`), so the
	card they were launched from re-renders with a subscription that no longer
	offers that action.
	Rendered inside, the open dialog would be destroyed mid-read — an unannounced
	context change that drops focus to <body> (WCAG 3.2). Each is gated only on
	its own `open` state, which nothing outside this file can set. The remaining
	`{#if sub}` is a type guard, not a state branch: both dialogs require a
	subscription, and a card that loses one entirely unmounts with it anyway.
-->
{#if sub}
	<ChangePlanDialog open={changePlanOpen} onOpenChange={(next) => (changePlanOpen = next)} {sub} />
	<CancelSubscriptionDialog open={cancelOpen} onOpenChange={(next) => (cancelOpen = next)} {sub} />
{/if}
