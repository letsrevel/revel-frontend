<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { mesubscriptionsReviveSubscription } from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { formatPlanPrice } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		/** An `expired` ONLINE subscription still inside its revival window. */
		sub: MySubscriptionSchema;
	}

	const { sub }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let errorMessage = $state<string | null>(null);
	// Set on success and never cleared: the browser is on its way to Stripe, so
	// the CTA must stay busy until this document is replaced.
	let redirecting = $state(false);

	// `expired_at` is the precise stamp, but it is optional on the schema; the
	// fallbacks keep the sentence from reading "— " for a row the backend
	// expired without one.
	const expiredAt = $derived(sub.expired_at ?? sub.cancelled_at ?? sub.updated_at);
	const deadline = $derived(sub.revival_deadline);

	function backendMessage(error: unknown): string | null {
		if (!error || typeof error !== 'object') return null;
		const body = error as { message?: unknown; detail?: unknown };
		if (typeof body.message === 'string' && body.message) return body.message;
		if (typeof body.detail === 'string' && body.detail) return body.detail;
		return null;
	}

	const reviveMutation = createMutation(() => ({
		mutationFn: async () => {
			errorMessage = null;
			const res = await mesubscriptionsReviveSubscription({
				path: { org_id: sub.organization_id },
				// ONLINE revival takes an empty body — the amount/currency fields are
				// the OFFLINE (staff-recorded) half of `RevivalRequestSchema`.
				body: {},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscriptions.rejoin.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			// A null URL is the OFFLINE answer; this card is only offered for ONLINE
			// subscriptions, so getting one here means no Checkout session exists to
			// send the member to.
			if (!data.checkout_url) {
				errorMessage = m['subscriptions.rejoin.error']();
				return;
			}
			redirecting = true;
			// Hosted Stripe Checkout lives on another origin: a real document
			// navigation, not a SvelteKit one.
			window.location.href = data.checkout_url;
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['subscriptions.rejoin.error']();
		}
	}));

	// Both operands are read unconditionally: a short-circuiting `||` would skip
	// `redirecting` whenever the mutation is still pending, leaving it untracked.
	const isBusy = $derived.by(() => {
		const pending = reviveMutation.isPending;
		const goingToStripe = redirecting;
		return pending || goingToStripe;
	});
</script>

<Card class="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
	<CardContent class="p-4">
		<article aria-label={sub.organization_name}>
			<h3 class="font-semibold">
				{m['subscriptions.rejoin.title']({ org: sub.organization_name })}
			</h3>

			<p class="mt-1 text-sm">
				{m['subscriptions.rejoin.body']({
					expired: formatDate(expiredAt),
					deadline: deadline ? formatDate(deadline) : '—'
				})}
			</p>

			<p class="mt-2 text-sm text-muted-foreground">
				{sub.plan.name} · {formatPlanPrice(sub.plan)}
			</p>

			<div class="mt-3">
				<Button size="sm" onclick={() => reviveMutation.mutate()} disabled={isBusy}>
					{#if isBusy}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['subscriptions.rejoin.cta']()}
				</Button>
			</div>

			<p class="mt-2 text-xs text-muted-foreground">
				{m['subscriptions.rejoin.returnHint']()}
			</p>

			{#if errorMessage}
				<p role="alert" class="mt-2 text-sm font-medium text-destructive">{errorMessage}</p>
			{/if}
		</article>
	</CardContent>
</Card>
