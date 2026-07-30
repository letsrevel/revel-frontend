<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
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
	}

	const {
		plan,
		isAuthenticated,
		onSubscribe,
		organizationSlug,
		subscription = null,
		subscriptionLoading = false
	}: Props = $props();

	/**
	 * What the card offers, in precedence order:
	 * already subscribed → offline → sold out → paused → subscribe/login → nothing.
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
	 */
	const action = $derived.by(() => {
		if (subscription) {
			return plan.id && plan.id === subscription.plan_id ? 'current' : 'member';
		}
		if (plan.payment_method === 'offline') return 'offline';
		if (plan.sold_out) return 'none';
		if (plan.sales_status === 'paused') return 'none';
		if (!plan.id) return 'none';
		return isAuthenticated ? 'subscribe' : 'login';
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

	const loginHref = $derived(
		`${resolve('/(public)/login', {})}?returnUrl=${encodeURIComponent(
			resolve('/(public)/org/[slug]', { slug: organizationSlug })
		)}`
	);

	const membershipsHref = resolve('/(auth)/account/memberships', {});

	function handleSubscribe(): void {
		// Re-narrowed at the call site: `action === 'subscribe'` already implies
		// an id, but TypeScript cannot carry that through the derived.
		if (!plan.id) return;
		onSubscribe({ ...plan, id: plan.id });
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
			{:else if action === 'subscribe'}
				<!-- Disabled only while the membership lookup is in flight: until it
				     answers we do not know whether this button would 400. It is a
				     transient state on a control that keeps its label and its box, so
				     nothing shifts and nothing is conveyed by colour alone. -->
				<Button class="w-full sm:w-auto" onclick={handleSubscribe} disabled={subscriptionLoading}>
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
