<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Plus, Minus } from '@lucide/svelte';

	interface Props {
		quantity: number;
		effectiveMaxQuantity: number;
		isPwyc: boolean;
		/** Category-priced tier (seat_pricing present): hide the flat total. */
		isCategoryPriced?: boolean;
		currency: string;
		price: string | number;
		isSubmitting: boolean;
		onIncrement: () => void;
		onDecrement: () => void;
	}

	const {
		quantity,
		effectiveMaxQuantity,
		isPwyc,
		isCategoryPriced = false,
		currency,
		price,
		isSubmitting,
		onIncrement,
		onDecrement
	}: Props = $props();
</script>

<div class="space-y-2">
	<Label for="quantity">{m['guestTicketDialog.numberOfTickets']()}</Label>
	<div class="flex items-center gap-3">
		<Button
			type="button"
			variant="outline"
			size="icon"
			onclick={onDecrement}
			disabled={quantity <= 1 || isSubmitting}
			aria-label={m['guestTicketDialog.decreaseQuantity']()}
		>
			<Minus class="h-4 w-4" />
		</Button>
		<div
			class="flex h-10 w-16 items-center justify-center rounded-md border border-border bg-background"
		>
			<span class="text-lg font-semibold">{quantity}</span>
		</div>
		<Button
			type="button"
			variant="outline"
			size="icon"
			onclick={onIncrement}
			disabled={quantity >= effectiveMaxQuantity || isSubmitting}
			aria-label={m['guestTicketDialog.increaseQuantity']()}
		>
			<Plus class="h-4 w-4" />
		</Button>
		<span class="text-sm text-muted-foreground">
			{#if effectiveMaxQuantity < 100}
				{m['guestTicketDialog.maxQuantity']({ max: effectiveMaxQuantity })}
			{/if}
		</span>
	</div>
	<!-- Flat unit-price total only: on a category-priced tier the buyer pays
	     per seat/zone, so quoting price × quantity here would be dishonest —
	     the sticky footer total (checkout-total.ts) owns the number there. -->
	{#if !isPwyc && !isCategoryPriced}
		<p class="text-sm font-semibold text-primary">
			{m['guestTicketDialog.total']()}
			{currency}
			{(quantity * (typeof price === 'string' ? parseFloat(price) : price || 0)).toFixed(2)}
		</p>
	{/if}
</div>
