<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { untrack } from 'svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		mesubscriptionsGetMySubscription,
		mesubscriptionsSubscribe
	} from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { PollUntil } from '$lib/queries/poll-until';
	import { authStore } from '$lib/stores/auth.svelte';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { isSubscriptionActivationPending } from '$lib/utils/subscriptions';
	import { myOrgSubscriptionKey } from '$lib/utils/subscription-cache';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	interface Props {
		organizationId: string;
		organizationSlug: string;
		/** Which Stripe return URL the member landed on. */
		outcome: 'success' | 'cancelled';
	}

	const { organizationId, organizationSlug, outcome }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	/**
	 * 404 means "never subscribed"; any other failure is indistinguishable from
	 * it here and is equally safe to treat as "nothing yet" — the poll simply
	 * tries again on its next tick.
	 */
	async function fetchSubscription(): Promise<MySubscriptionSchema | null> {
		const res = await mesubscriptionsGetMySubscription({
			path: { org_id: organizationId },
			headers: { Authorization: `Bearer ${authStore.accessToken}` }
		});
		if (res.error || !res.data) return null;
		return res.data;
	}

	// ---------------------------------------------------------------- success

	// The reactive signal for a lapsed deadline: `phase()` reads the wall clock,
	// but identical pending payloads are collapsed by structural sharing, so
	// `q.data` alone would never re-trigger the derived below.
	let timedOut = $state(false);

	// Set when a resume attempt comes back with the activation-pending 409: the
	// member has already been charged, so from here the cancelled outcome behaves
	// exactly like the success one — poll until the webhook lands.
	let activationPending = $state(false);
	/** The backend's translated explanation for that 409, when it sent one. */
	let activationDetail = $state<string | null>(null);

	/** Render the polling/welcome card rather than the "not completed" one. */
	const isConfirming = $derived(outcome === 'success' || activationPending);

	// Constructed once, at setup: the deadline is measured from construction, so
	// rebuilding this inside a `$derived` would restart the clock on every pass.
	const poll = new PollUntil<MySubscriptionSchema | null>({
		// `untrack` states the intent the compiler would otherwise warn about:
		// the key is frozen at mount, because this card is rendered once per
		// checkout-return page load and never re-targeted at another org.
		// Built from the exported key so this poll cache stays a genuine CHILD of
		// the per-org subscription key — that prefix relationship is what lets the
		// invalidation below clear it, and a hand-written literal would break it
		// silently on a rename.
		queryKey: untrack(() => [...myOrgSubscriptionKey(organizationId), 'checkout-return']),
		queryFn: fetchSubscription,
		isDone: (sub) => sub?.status === 'active',
		// `options()` is re-read on every reactive pass, so flipping
		// `activationPending` starts this poll on the cancelled outcome too.
		enabled: () => isConfirming && !!accessToken,
		onTimeout: () => (timedOut = true)
	});

	const pollQuery = createQuery(() => poll.options());

	const phase = $derived.by(() => {
		void timedOut;
		return poll.phase(pollQuery.data);
	});

	// The webhook has landed; the org page and the account view still hold the
	// pre-checkout answer. Fire once, on the transition into `done` — every
	// consumer of the stale verdict is refreshed together, or the card would say
	// "Welcome, member!" next to an action row still offering "Join".
	let invalidated = $state(false);
	$effect(() => {
		if (phase !== 'done' || invalidated) return;
		invalidated = true;
		// The inline membership card.
		queryClient.invalidateQueries({ queryKey: myOrgSubscriptionKey(organizationId) });
		// Admin views of this org; a no-op on the public page, kept for the
		// authenticated-admin case and future consumers of the prefix.
		queryClient.invalidateQueries({ queryKey: ['organization', organizationSlug] });
		// MembershipCta's verdict: fetched on mount of this fresh document, so it
		// almost always predates the webhook and caches "join" for `staleTime`.
		queryClient.invalidateQueries({ queryKey: ['org', organizationSlug, 'join-eligibility'] });
		// `isMember` and the member-only sections come from the server load, which
		// ran before the subscription existed; only a re-run flips them.
		invalidateAll();
	});

	// -------------------------------------------------------------- cancelled

	// A single look, not a poll: nothing is going to change server-side until the
	// member acts.
	const cancelledQuery = createQuery(() => ({
		queryKey: [...myOrgSubscriptionKey(organizationId), 'checkout-cancelled'],
		queryFn: fetchSubscription,
		enabled: outcome === 'cancelled' && !!accessToken,
		retry: false,
		staleTime: 0
	}));

	// Only a `pending` subscription is resumable — it is the record the abandoned
	// Checkout session left behind.
	const resumableSub = $derived.by(() => {
		const sub = cancelledQuery.data;
		return sub && sub.status === 'pending' ? sub : null;
	});

	let resumeError = $state<string | null>(null);
	let redirecting = $state(false);

	/**
	 * Switch the card over to the confirming state.
	 *
	 * `poll.reset()` is load-bearing: the deadline runs from construction, and a
	 * member can sit on the cancelled card for minutes before pressing Resume, so
	 * an unreset poll would render "this is taking longer than usual" the instant
	 * it started — or never tick at all.
	 */
	function enterActivationPending(detail: string | null): void {
		if (activationPending) return;
		poll.reset();
		timedOut = false;
		resumeError = null;
		// The backend's own sentence ("Your payment went through. We're still
		// confirming your subscription…"), already translated server-side. Shown
		// alongside the generic confirming line because this member just pressed
		// "Resume payment" and would otherwise have no way to tell that they are
		// not expected to pay again.
		activationDetail = detail;
		activationPending = true;
	}

	const resumeMutation = createMutation(() => ({
		mutationFn: async () => {
			resumeError = null;
			const planId = resumableSub?.plan_id;
			if (!planId) throw new Error(m['subscribe.error']());
			const res = await mesubscriptionsSubscribe({
				path: { org_id: organizationId },
				body: { plan_id: planId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// The money-critical branch: the abandoned session turned out to be paid
			// and the activation webhooks are still in flight. The member has been
			// charged, so this is not a failure — it is the same "confirming your
			// subscription" wait the success return shows, and the poll picks up the
			// activation as soon as the webhook lands. Keyed on the backend's
			// machine-readable `code`; its `detail` is translated and unmatchable.
			if (isSubscriptionActivationPending(res.error)) {
				enterActivationPending(backendMessage(res.error));
				return null;
			}
			// Otherwise the same dual-shape probe as SubscribeDialog: django-ninja
			// sends `{ detail }`, not the `{ message }` the generated type promises,
			// and reading only one of them would bury every real reason (plan
			// archived, sold out, org not Stripe-connected) behind generic copy.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscribe.error']());
			}
			// `checkout_url` is nullable since FREE plans landed (#832). A null one is
			// not a failure and has nothing to resume: the row it comes back with is
			// already ACTIVE. (Practically unreachable — only a `pending` row reaches
			// this button, and a FREE subscription is created ACTIVE — but reporting
			// "could not start the checkout" for a live membership would be a lie.)
			// The confirming state is the honest landing: its poll sees `active` on
			// its first tick and runs the same invalidations the Stripe path does.
			if (!res.data.checkout_url) {
				enterActivationPending(null);
				return null;
			}
			return { ...res.data, checkout_url: res.data.checkout_url };
		},
		onSuccess: (data) => {
			// `null` is the activation-pending answer — nowhere to redirect to; the
			// card is already showing the confirming state.
			if (!data) return;
			redirecting = true;
			window.location.href = data.checkout_url;
		},
		onError: (err: Error) => {
			resumeError = err.message || m['subscribe.error']();
		}
	}));

	// Both operands read unconditionally — see SubscribeDialog for why `||` alone
	// would leave `redirecting` untracked.
	const isResuming = $derived.by(() => {
		const pending = resumeMutation.isPending;
		const goingToStripe = redirecting;
		return pending || goingToStripe;
	});

	const membershipsHref = resolve('/(auth)/account/memberships', {});
</script>

{#if isConfirming}
	<Card
		class={phase === 'done'
			? 'border-success/50 bg-success/10'
			: phase === 'timed_out'
				? 'border-highlight/60 bg-highlight/10'
				: ''}
	>
		<CardContent class="p-4">
			<div role="status" aria-live="polite">
				{#if phase === 'polling'}
					<p class="flex items-center gap-2 text-sm">
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{m['subscribe.return.confirming']()}
					</p>
					{#if activationDetail}
						<p class="mt-1 text-sm">{activationDetail}</p>
					{/if}
				{:else if phase === 'done'}
					<h2 class="text-lg font-extrabold">{m['subscribe.return.welcome']()}</h2>
					<p class="mt-1 text-sm">{m['subscribe.return.welcomeBody']()}</p>
				{:else}
					<h2 class="text-lg font-extrabold">{m['subscribe.return.slowTitle']()}</h2>
					<p class="mt-1 text-sm">{m['subscribe.return.slow']()}</p>
				{/if}
			</div>
			{#if phase === 'timed_out'}
				<a
					href={membershipsHref}
					class="mt-3 inline-block text-sm font-bold text-primary underline-offset-4 hover:underline"
				>
					{m['subscribe.return.checkAccount']()}
				</a>
			{/if}
		</CardContent>
	</Card>
{:else}
	<Card class="border-highlight/60 bg-highlight/10">
		<CardContent class="p-4">
			<h2 class="text-lg font-extrabold">{m['subscribe.return.cancelledTitle']()}</h2>
			<p class="mt-1 text-sm">{m['subscribe.return.cancelledBody']()}</p>

			{#if resumableSub}
				<Button class="mt-3" onclick={() => resumeMutation.mutate()} disabled={isResuming}>
					{#if isResuming}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['subscribe.return.resumeCta']()}
				</Button>
			{/if}

			{#if resumeError}
				<p role="alert" class="mt-3 text-sm font-medium text-destructive">{resumeError}</p>
			{/if}
		</CardContent>
	</Card>
{/if}
