<script lang="ts">
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Edit } from 'lucide-svelte';

	interface Props {
		tier: TicketTierDetailSchema;
		onEdit: () => void;
		onDelete?: () => void; // Phase 2: Add delete functionality
	}

	let { tier, onEdit }: Props = $props();

	let priceDisplay = $derived(() => {
		if (tier.payment_method === 'free') return 'Free';
		if (tier.price_type === 'pwyc') {
			const max = tier.pwyc_max ? `$${Number(tier.pwyc_max).toFixed(2)}` : 'any';
			return `Pay What You Can ($${Number(tier.pwyc_min).toFixed(2)} - ${max})`;
		}
		return `$${Number(tier.price).toFixed(2)}`;
	});

	let quantityDisplay = $derived(() => {
		if (tier.total_quantity === null) return 'Unlimited';
		const available = tier.total_available ?? 0;
		return `${available} of ${tier.total_quantity} remaining`;
	});

	let paymentMethodDisplay = $derived(() => {
		return tier.payment_method.replace(/_/g, ' ');
	});

	let visibilityDisplay = $derived(() => {
		return tier.visibility.replace(/-/g, ' ');
	});

	let purchasableByDisplay = $derived(() => {
		return tier.purchasable_by.replace(/_/g, ' ');
	});
</script>

<Card class="p-4">
	<div class="flex items-start justify-between">
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h3 class="text-lg font-semibold">🎟️ {tier.name}</h3>
				{#if tier.name === 'General Admission'}
					<span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">Default</span>
				{/if}
			</div>

			<dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				<div>
					<dt class="text-muted-foreground">Price</dt>
					<dd class="font-medium">{priceDisplay()}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Payment</dt>
					<dd class="font-medium capitalize">{paymentMethodDisplay()}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Visibility</dt>
					<dd class="font-medium capitalize">{visibilityDisplay()}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Available to</dt>
					<dd class="font-medium capitalize">{purchasableByDisplay()}</dd>
				</div>
				<div class="col-span-2">
					<dt class="text-muted-foreground">Quantity</dt>
					<dd class="font-medium">{quantityDisplay()}</dd>
				</div>
			</dl>

			{#if tier.description}
				<p class="mt-2 text-sm text-muted-foreground">{tier.description}</p>
			{/if}
		</div>

		<Button variant="ghost" size="icon" onclick={onEdit} aria-label="Edit {tier.name}">
			<Edit class="h-4 w-4" />
		</Button>
	</div>
</Card>
