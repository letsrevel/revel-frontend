<script lang="ts">
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import TierCard from './TierCard.svelte';
	import { Ticket } from 'lucide-svelte';

	interface Props {
		tiers: TierSchemaWithId[];
		isAuthenticated: boolean;
		hasTicket?: boolean;
		onClaimTicket: (tierId: string) => void | Promise<void>;
	}

	let { tiers, isAuthenticated, hasTicket = false, onClaimTicket }: Props = $props();

	// Filter out hidden tiers and sort by price
	let visibleTiers = $derived(
		tiers
			.filter((tier) => tier.payment_method !== 'hidden')
			.sort((a, b) => {
				const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
				const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
				return priceA - priceB;
			})
	);

	let hasTiers = $derived(visibleTiers.length > 0);
</script>

{#if hasTiers}
	<section class="rounded-lg border border-border bg-card p-6" aria-labelledby="ticket-tiers">
		<div class="mb-4 flex items-center gap-2">
			<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
			<h2 id="ticket-tiers" class="text-xl font-bold">Ticket Options</h2>
		</div>

		<div class="space-y-4">
			{#each visibleTiers as tier (tier.id || tier.event_id + tier.name)}
				<TierCard {tier} {isAuthenticated} {hasTicket} {onClaimTicket} />
			{/each}
		</div>

		{#if !isAuthenticated}
			<p class="mt-4 text-sm text-muted-foreground">
				<a href="/login" class="font-medium text-primary hover:underline">Sign in</a>
				to claim your ticket
			</p>
		{/if}
	</section>
{/if}
