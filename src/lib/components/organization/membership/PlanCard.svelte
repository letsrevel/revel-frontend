<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PublicPlanSchema } from '$lib/api/generated/types.gen';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { formatPlanPrice } from '$lib/utils/subscriptions';
	import { resolve } from '$app/paths';

	interface Props {
		plan: PublicPlanSchema;
		isAuthenticated: boolean;
		/** Called only for a subscribable plan, so `id` is guaranteed present. */
		onSubscribe: (plan: PublicPlanSchema & { id: string }) => void;
		/** Where the login round trip should come back to. */
		organizationSlug: string;
	}

	const { plan, isAuthenticated, onSubscribe, organizationSlug }: Props = $props();

	/**
	 * What the card offers, in the spec's precedence order:
	 * offline → sold out → paused → subscribe/login → nothing.
	 *
	 * `none` covers a plan the backend exposes without an id: it cannot be
	 * subscribed to, and a CTA would only produce a failed checkout.
	 */
	const action = $derived.by(() => {
		if (plan.payment_method === 'offline') return 'offline';
		if (plan.sold_out) return 'none';
		if (plan.sales_status === 'paused') return 'none';
		if (!plan.id) return 'none';
		return isAuthenticated ? 'subscribe' : 'login';
	});

	/**
	 * The badge is independent of the CTA: an offline plan that is sold out
	 * still says so. Sold out outranks paused — it is the harder stop.
	 */
	const state = $derived.by(() => {
		if (plan.sold_out) return 'sold_out';
		if (plan.sales_status === 'paused') return 'paused';
		return null;
	});

	const loginHref = $derived(
		`${resolve('/(public)/login', {})}?returnUrl=${encodeURIComponent(
			resolve('/(public)/org/[slug]', { slug: organizationSlug })
		)}`
	);

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
			{#if state === 'sold_out'}
				<Badge variant="secondary">{m['membershipPlans.soldOut']()}</Badge>
			{:else if state === 'paused'}
				<Badge variant="secondary">{m['membershipPlans.paused']()}</Badge>
			{/if}
		</div>

		<p class="text-xl font-semibold">{formatPlanPrice(plan)}</p>

		{#if plan.description}
			<p class="whitespace-pre-line text-sm text-muted-foreground">{plan.description}</p>
		{/if}

		{#if state === 'sold_out'}
			<p class="text-sm text-muted-foreground">{m['membershipPlans.soldOutHelper']()}</p>
		{:else if state === 'paused'}
			<p class="text-sm text-muted-foreground">{m['membershipPlans.pausedHelper']()}</p>
		{/if}

		<div class="mt-auto pt-1">
			{#if action === 'offline'}
				<p class="text-sm text-muted-foreground">{m['membershipPlans.offlineManaged']()}</p>
			{:else if action === 'subscribe'}
				<Button class="w-full sm:w-auto" onclick={handleSubscribe}>
					{m['membershipPlans.subscribeCta']()}
				</Button>
			{:else if action === 'login'}
				<!-- A real link, not a scripted redirect: it survives no-JS,
				     middle-click and "open in new tab". -->
				<Button href={loginHref} class="w-full sm:w-auto">
					{m['membershipPlans.loginToSubscribe']()}
				</Button>
			{/if}
		</div>
	</CardContent>
</Card>
