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
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';
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

	// Constructed once, at setup: the deadline is measured from construction, so
	// rebuilding this inside a `$derived` would restart the clock on every pass.
	const poll = new PollUntil<MySubscriptionSchema | null>({
		// `untrack` states the intent the compiler would otherwise warn about:
		// the key is frozen at mount, because this card is rendered once per
		// checkout-return page load and never re-targeted at another org.
		queryKey: untrack(() => ['me', 'org', organizationId, 'subscription', 'checkout-return']),
		queryFn: fetchSubscription,
		isDone: (sub) => sub?.status === 'active',
		enabled: () => outcome === 'success' && !!accessToken,
		onTimeout: () => (timedOut = true)
	});

	const pollQuery = createQuery(() => poll.options());

	const phase = $derived.by(() => {
		void timedOut;
		return poll.phase(pollQuery.data);
	});

	// The webhook has landed; the org page and the account view still hold the
	// pre-checkout answer. Fire once, on the transition into `done`.
	let invalidated = $state(false);
	$effect(() => {
		if (phase !== 'done' || invalidated) return;
		invalidated = true;
		queryClient.invalidateQueries({ queryKey: ['me', 'org', organizationId, 'subscription'] });
		queryClient.invalidateQueries({ queryKey: ['organization', organizationSlug] });
	});

	// -------------------------------------------------------------- cancelled

	// A single look, not a poll: nothing is going to change server-side until the
	// member acts.
	const cancelledQuery = createQuery(() => ({
		queryKey: ['me', 'org', organizationId, 'subscription', 'checkout-cancelled'],
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
			if (res.error || !res.data) {
				throw new Error(res.error?.message ?? m['subscribe.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
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

{#if outcome === 'success'}
	<Card
		class={phase === 'done'
			? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40'
			: phase === 'timed_out'
				? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
				: ''}
	>
		<CardContent class="p-4">
			<div role="status" aria-live="polite">
				{#if phase === 'polling'}
					<p class="flex items-center gap-2 text-sm">
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{m['subscribe.return.confirming']()}
					</p>
				{:else if phase === 'done'}
					<h2 class="text-lg font-semibold">{m['subscribe.return.welcome']()}</h2>
					<p class="mt-1 text-sm">{m['subscribe.return.welcomeBody']()}</p>
				{:else}
					<h2 class="text-lg font-semibold">{m['subscribe.return.slowTitle']()}</h2>
					<p class="mt-1 text-sm">{m['subscribe.return.slow']()}</p>
				{/if}
			</div>
			{#if phase === 'timed_out'}
				<a
					href={membershipsHref}
					class="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
				>
					{m['subscribe.return.checkAccount']()}
				</a>
			{/if}
		</CardContent>
	</Card>
{:else}
	<Card class="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
		<CardContent class="p-4">
			<h2 class="text-lg font-semibold">{m['subscribe.return.cancelledTitle']()}</h2>
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
