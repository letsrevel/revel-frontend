<script lang="ts">
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { hasTierId } from '$lib/types/tickets';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Ticket, Clock, Users } from 'lucide-svelte';

	interface Props {
		tier: TierSchemaWithId;
		isAuthenticated: boolean;
		hasTicket?: boolean;
		onClaimTicket: (tierId: string) => void | Promise<void>;
	}

	let { tier, isAuthenticated, hasTicket = false, onClaimTicket }: Props = $props();

	// Check if tier has ID (required for checkout)
	let hasId = $derived(hasTierId(tier));

	let isClaiming = $state(false);

	// Format price display
	let priceDisplay = $derived(() => {
		if (tier.payment_method === 'free') return 'Free';

		if (tier.price_type === 'pwyc') {
			const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
			const min = tier.pwyc_min
				? typeof tier.pwyc_min === 'string'
					? parseFloat(tier.pwyc_min)
					: tier.pwyc_min
				: price;
			const max = tier.pwyc_max
				? typeof tier.pwyc_max === 'string'
					? parseFloat(tier.pwyc_max)
					: tier.pwyc_max
				: null;

			const maxDisplay = max ? `${tier.currency}${max.toFixed(2)}` : 'any';
			return `Pay What You Can (${tier.currency}${min.toFixed(2)} - ${maxDisplay})`;
		}

		const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
		return `${tier.currency}${price.toFixed(2)}`;
	});

	// Check if sales are active
	let salesStatus = $derived.by(() => {
		const now = new Date();

		if (tier.sales_start_at) {
			const salesStart = new Date(tier.sales_start_at);
			if (now < salesStart) {
				return { active: false, message: `Sales start ${salesStart.toLocaleDateString()}` };
			}
		}

		if (tier.sales_end_at) {
			const salesEnd = new Date(tier.sales_end_at);
			if (now > salesEnd) {
				return { active: false, message: 'Sales ended' };
			}
		}

		return { active: true, message: null };
	});

	// Check availability
	let availabilityStatus = $derived.by(() => {
		if (tier.total_available === null) {
			return { available: true, message: 'Unlimited' };
		}

		if (tier.total_available === 0) {
			return { available: false, message: 'Sold out' };
		}

		return { available: true, message: `${tier.total_available} remaining` };
	});

	// Can claim ticket
	let canClaim = $derived(
		hasId &&
			isAuthenticated &&
			!hasTicket &&
			salesStatus.active &&
			availabilityStatus.available &&
			tier.payment_method === 'free'
	);

	async function handleClaim() {
		if (!canClaim || isClaiming || !hasId) return;

		isClaiming = true;
		try {
			await onClaimTicket(tier.id);
		} finally {
			isClaiming = false;
		}
	}
</script>

<Card class="p-4">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<!-- Tier Info -->
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
				<h3 class="text-lg font-semibold">{tier.name}</h3>
			</div>

			<div class="mt-2 text-2xl font-bold text-primary">{priceDisplay()}</div>

			{#if tier.description}
				<p class="mt-2 text-sm text-muted-foreground">{tier.description}</p>
			{/if}

			<!-- Status Indicators -->
			<dl class="mt-3 flex flex-wrap gap-4 text-sm">
				{#if !salesStatus.active}
					<div class="flex items-center gap-1.5 text-muted-foreground">
						<Clock class="h-4 w-4" aria-hidden="true" />
						<dd>{salesStatus.message}</dd>
					</div>
				{/if}

				{#if tier.total_available !== null}
					<div
						class="flex items-center gap-1.5"
						class:text-destructive={!availabilityStatus.available}
					>
						<Users class="h-4 w-4" aria-hidden="true" />
						<dd>{availabilityStatus.message}</dd>
					</div>
				{/if}
			</dl>
		</div>

		<!-- Action Button -->
		<div class="flex shrink-0 items-center">
			{#if !hasId}
				<div class="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
					Configuration Error
				</div>
			{:else if hasTicket}
				<div class="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-800">
					✓ You have a ticket
				</div>
			{:else if tier.payment_method === 'free' && canClaim}
				<Button onclick={handleClaim} disabled={isClaiming} class="w-full sm:w-auto">
					{isClaiming ? 'Claiming...' : 'Claim Free Ticket'}
				</Button>
			{:else if tier.payment_method === 'free' && !isAuthenticated}
				<Button href="/login" variant="outline" class="w-full sm:w-auto">Sign in to Claim</Button>
			{:else if tier.payment_method === 'free' && !salesStatus.active}
				<Button disabled class="w-full sm:w-auto">Not Available</Button>
			{:else if tier.payment_method === 'free' && !availabilityStatus.available}
				<Button disabled class="w-full sm:w-auto">Sold Out</Button>
			{:else}
				<div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">Coming Soon</div>
			{/if}
		</div>
	</div>
</Card>
