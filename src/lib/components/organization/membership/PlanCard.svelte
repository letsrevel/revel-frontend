<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
	import type { MembershipGateAction } from '$lib/utils/membership-eligibility';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		canSwitchToPlan,
		formatPlanPrice,
		isFreePlan,
		isLifetimePlan
	} from '$lib/utils/subscriptions';
	import { resolve } from '$app/paths';

	interface Props {
		plan: PublicPlanSchema;
		isAuthenticated: boolean;
		/** Called only for a subscribable plan, so `id` is guaranteed present. */
		onSubscribe: (plan: PublicPlanSchema & { id: string }) => void;
		/** Where the login round trip should come back to. */
		organizationSlug: string;
		/**
		 * The viewer's live subscription in this organization, or `null` when they
		 * have none. The backend only ever hands back a *non-terminal* row here,
		 * so a non-null value is precisely the case where `POST …/subscribe`
		 * answers 400 — a cancelled or expired member arrives as `null` and can
		 * subscribe again, with no status list duplicated on this side.
		 */
		subscription?: MySubscriptionSchema | null;
		/** The subscription lookup is still in flight — the answer is not known yet. */
		subscriptionLoading?: boolean;
		/**
		 * What the tier's membership gates leave this viewer to do with this plan
		 * (#733, #735). Resolved by `TierCard` from a plan-bearing eligibility
		 * verdict — never from the tier's static `questionnaire_id` /
		 * `requires_approval`, which say the tier is gated, not that this viewer is
		 * behind the gate.
		 *
		 * `null` means "nothing in the way", and that is also what an UNKNOWN
		 * verdict resolves to (guest, ungated tier, request in flight or failed).
		 * Withdrawing the CTA from somebody who is in fact eligible is a worse
		 * failure than the dead button #733 removed, and `POST …/subscribe` runs
		 * the whole gate stack itself (BE #831) — so an unknown answer costs a 400
		 * at worst, never an unreachable plan.
		 */
		gateAction?: MembershipGateAction | null;
		/** Localized explanation of that gate, rendered where the CTA was. */
		gateReason?: string | null;
		/**
		 * Open the application dialog for THIS plan. Called only from the `apply` /
		 * `reapply` branches, so the plan has an id by construction — the
		 * application's `plan` FK is what makes it a paid application, and it must
		 * be the plan whose card was pressed.
		 */
		onApply?: (plan: PublicPlanSchema & { id: string }, mode: 'join' | 'reapply') => void;
		/** The verdict is still in flight: hold the CTA rather than offer it. */
		gatePending?: boolean;
		/**
		 * Id of the tier's requirement list, so the withheld-CTA note points at the
		 * full requirements rather than relying on them merely being nearby.
		 */
		gateRequirementsId?: string | null;
	}

	const {
		plan,
		isAuthenticated,
		onSubscribe,
		organizationSlug,
		subscription = null,
		subscriptionLoading = false,
		gateAction = null,
		gateReason = null,
		onApply,
		gatePending = false,
		gateRequirementsId = null
	}: Props = $props();

	/**
	 * What the card offers, in precedence order:
	 * already subscribed → offline → sold out → paused → gated → subscribe/login.
	 *
	 * The membership check comes first because it is a fact about the *viewer*,
	 * and it outranks every fact about the plan: an existing member cannot buy
	 * this plan whether it is offline, sold out or wide open.
	 *
	 * `none` covers a plan the backend exposes without an id: it cannot be
	 * subscribed to, and a CTA would only produce a failed checkout.
	 *
	 * Only OFFLINE is a dead end. A FREE plan is un-billed too, but it is
	 * *member* self-serve — `POST …/subscribe` accepts it and activates the
	 * subscription on the spot — so it takes the ordinary join path, with the
	 * label and dialog copy adjusted for the absent charge.
	 *
	 * The gate branches sit second-to-last, below every plan-level stop and above
	 * the viewer's own CTA (#733). Since BE #831 a tier can be gated AND priced,
	 * and a questionnaire the viewer has not passed makes Subscribe an action that
	 * cannot succeed: `/subscribe` runs the same gate stack and refuses with a
	 * 400 — after the member has committed to a concrete charge.
	 *
	 * What replaces it depends on WHOSE move it is (#735):
	 *
	 * - `apply` / `reapply` — the member's. The gate is waiting on an application
	 *   that only they can create, so the card offers exactly that, carrying this
	 *   plan's id. Withdrawing the CTA and stopping (the whole of #733) left an
	 *   approval-gated priced tier with no affordance anywhere: unlike a
	 *   questionnaire, whose link `TierCard` renders straight off the tier, an
	 *   application has no other entry point.
	 * - `gated` — somebody else's, or nothing at all: staff are deciding, the
	 *   grader is running, the cooldown has not expired. No control, and the
	 *   reason in its place. The price stays on the card above either way, so what
	 *   they are working toward stays visible.
	 *
	 * A guest is untouched: nobody has asked the backend about them, and "Log in
	 * to subscribe" is true whatever their eligibility turns out to be.
	 */
	const action = $derived.by(() => {
		if (subscription) {
			return plan.id && plan.id === subscription.plan_id ? 'current' : 'member';
		}
		if (plan.payment_method === 'offline') return 'offline';
		if (plan.sold_out) return 'none';
		if (plan.sales_status === 'paused') return 'none';
		if (!plan.id) return 'none';
		if (!isAuthenticated) return 'login';
		if (gateAction === 'apply') return 'apply';
		if (gateAction === 'reapply') return 'reapply';
		return gateAction ? 'gated' : 'subscribe';
	});

	/** True for both application branches — they differ only in wording and mode. */
	const isApplyAction = $derived(action === 'apply' || action === 'reapply');

	/**
	 * Held while either lookup is unsettled: until the subscription AND the gate
	 * verdict answer, we do not know whether this button would 400. Transient,
	 * on a control that keeps its label and its box, so nothing shifts and
	 * nothing is conveyed by colour alone.
	 */
	const ctaHeld = $derived.by(() => {
		const subLoading = subscriptionLoading;
		const gateLoading = gatePending;
		return subLoading || gateLoading;
	});

	/**
	 * The badge is independent of the CTA: an offline plan that is sold out
	 * still says so. "Your plan" outranks both — for the member already on it,
	 * the plan's sales state is somebody else's problem. Sold out then outranks
	 * paused: it is the harder stop.
	 */
	const state = $derived.by(() => {
		if (action === 'current') return 'current';
		if (plan.sold_out) return 'sold_out';
		if (plan.sales_status === 'paused') return 'paused';
		return null;
	});

	/**
	 * A PENDING row means a hosted Checkout was started and never finished (or
	 * its webhook has not landed). Saying "you're subscribed" would be a lie, and
	 * pushing a second checkout is exactly what the backend refuses — so the card
	 * points at the account hub, where the resume-payment action lives.
	 */
	const isPendingCheckout = $derived(subscription?.status === 'pending');

	const isFree = $derived(isFreePlan(plan));
	/** A non-renewing term — said in words, because the price line no longer
	    carries a cadence to imply it. */
	const neverExpires = $derived(isLifetimePlan(plan));

	/** Only linked when the change-plan flow would really offer this plan. */
	const canSwitch = $derived(subscription ? canSwitchToPlan(subscription, plan) : false);

	// Back to the tier grid, which is where plan cards live since #720 — not the
	// org landing page they used to sit on. Returning a visitor to a page that no
	// longer shows the plan they were about to take is the whole point of a
	// returnUrl going wrong. TierCard's own CTA already resolves to this route, so
	// the two agree.
	const loginHref = $derived(
		`${resolve('/(public)/login', {})}?returnUrl=${encodeURIComponent(
			resolve('/(public)/org/[slug]/membership', { slug: organizationSlug })
		)}`
	);

	const membershipsHref = resolve('/(auth)/account/memberships', {});

	function handleSubscribe(): void {
		// Re-narrowed at the call site: `action === 'subscribe'` already implies
		// an id, but TypeScript cannot carry that through the derived.
		if (!plan.id) return;
		onSubscribe({ ...plan, id: plan.id });
	}

	function handleApply(): void {
		// Same re-narrowing as above; the apply branches are equally id-gated.
		if (!plan.id) return;
		onApply?.({ ...plan, id: plan.id }, action === 'reapply' ? 'reapply' : 'join');
	}
</script>

<Card class="flex h-full flex-col">
	<CardContent class="flex flex-1 flex-col gap-3 p-4">
		<div class="flex flex-wrap items-start justify-between gap-2">
			<h4 class="font-semibold">{plan.name}</h4>
			{#if state === 'current'}
				<Badge variant="secondary">{m['membershipPlans.yourPlan']()}</Badge>
			{:else if state === 'sold_out'}
				<Badge variant="secondary">{m['membershipPlans.soldOut']()}</Badge>
			{:else if state === 'paused'}
				<Badge variant="secondary">{m['membershipPlans.paused']()}</Badge>
			{/if}
		</div>

		<p class="text-xl font-semibold">{formatPlanPrice(plan)}</p>

		{#if neverExpires}
			<p class="-mt-2 text-sm text-muted-foreground">{m['subscriptions.neverExpires']()}</p>
		{/if}

		{#if plan.description}
			<p class="whitespace-pre-line text-sm text-muted-foreground">{plan.description}</p>
		{/if}

		{#if state === 'sold_out'}
			<p class="text-sm text-muted-foreground">{m['membershipPlans.soldOutHelper']()}</p>
		{:else if state === 'paused'}
			<p class="text-sm text-muted-foreground">{m['membershipPlans.pausedHelper']()}</p>
		{/if}

		<div class="mt-auto pt-1">
			{#if action === 'current'}
				<!-- A marker, not a control: there is nothing to press here, so
				     nothing takes focus. The reason is plain text, never colour. -->
				<p class="text-sm text-muted-foreground">
					{isPendingCheckout
						? m['membershipPlans.pendingCheckoutHelper']()
						: m['membershipPlans.yourPlanHelper']()}
				</p>
			{:else if action === 'member'}
				<p class="text-sm text-muted-foreground">{m['membershipPlans.alreadySubscribed']()}</p>
				{#if canSwitch}
					<!-- The switch itself lives in the account hub's ChangePlanDialog;
					     this only navigates, so it can never 400. Labelled with the
					     plan name for screen-reader users, who hear these links out
					     of context and would otherwise get N identical "Change plan". -->
					<a
						href={membershipsHref}
						aria-label={m['membershipPlans.changePlanCtaAria']({ plan: plan.name })}
						class="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{m['membershipPlans.changePlanCta']()}<span aria-hidden="true"> →</span>
					</a>
				{/if}
			{:else if action === 'offline'}
				<p class="text-sm text-muted-foreground">{m['membershipPlans.offlineManaged']()}</p>
			{:else if isApplyAction}
				<!-- #735. The one branch where a blocked gate still leaves the member
				     something to press: the backend is waiting for an application that
				     does not exist yet (`submit_application`), or for a fresh one after
				     a rejection (`reapply`).
				     Named with the PLAN, not left as a bare "Apply": several of these
				     sit on one tier, a screen-reader user hears them out of context,
				     and the plan is exactly what distinguishes them — it is the id the
				     application will carry. -->
				<Button
					class="w-full sm:w-auto"
					onclick={handleApply}
					disabled={ctaHeld}
					aria-label={action === 'reapply'
						? m['membershipPlans.reapplyCtaAria']({ plan: plan.name })
						: m['membershipPlans.applyCtaAria']({ plan: plan.name })}
				>
					{action === 'reapply'
						? m['membershipPlans.reapplyCta']()
						: m['membershipPlans.applyCta']()}
				</Button>
				<!-- The order matters and is not obvious: approval comes BEFORE the
				     charge (the backend's PaymentReadyGate is last), so this says so
				     rather than letting the member expect a checkout. -->
				<p class="mt-2 text-sm text-muted-foreground">
					{isFree
						? m['membershipPlans.applyJoinHelper']()
						: m['membershipPlans.applySubscribeHelper']()}
				</p>
			{:else if action === 'gated'}
				<!-- What replaces the CTA carries the reason itself, rather than
				     leaving a bare gap next to a requirement stated elsewhere on the
				     card: the note IS the explanation, and `aria-describedby` ties it
				     to the tier's full requirement list so the association is
				     programmatic and not merely visual (WCAG 1.3.1). -->
				<p
					role="note"
					class="text-sm text-muted-foreground"
					aria-describedby={gateRequirementsId ?? undefined}
				>
					{isFree
						? m['membershipPlans.gatedJoinHelper']()
						: m['membershipPlans.gatedSubscribeHelper']()}
					{#if gateReason}
						<span class="block">{gateReason}</span>
					{/if}
				</p>
			{:else if action === 'subscribe'}
				<Button class="w-full sm:w-auto" onclick={handleSubscribe} disabled={ctaHeld}>
					{isFree ? m['membershipPlans.joinFreeCta']() : m['membershipPlans.subscribeCta']()}
				</Button>
				{#if isFree}
					<p class="mt-2 text-sm text-muted-foreground">{m['membershipPlans.freeHelper']()}</p>
				{/if}
			{:else if action === 'login'}
				<!-- A real link, not a scripted redirect: it survives no-JS,
				     middle-click and "open in new tab". -->
				<Button href={loginHref} class="w-full sm:w-auto">
					{isFree ? m['membershipPlans.loginToJoin']() : m['membershipPlans.loginToSubscribe']()}
				</Button>
			{/if}
		</div>
	</CardContent>
</Card>
