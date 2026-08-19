<script lang="ts">
	/** Inline quick-buy stepper on a tier card (#853). Unlike the dialog's
	 * TicketQuantitySelector this one starts at 0 and names its tier for AT. */
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Minus, Plus } from '@lucide/svelte';

	interface Props {
		tierName: string;
		quantity: number;
		max: number;
		onSetQuantity: (quantity: number) => void;
		disabled?: boolean;
	}

	const { tierName, quantity, max, onSetQuantity, disabled = false }: Props = $props();
</script>

<div
	class="flex items-center gap-2"
	role="group"
	aria-label={m['cart.quantityFor']({ tierName })}
	data-testid="tier-quantity-stepper"
>
	<Button
		variant="outline"
		size="icon"
		onclick={() => onSetQuantity(quantity - 1)}
		disabled={disabled || quantity <= 0}
		aria-label={m['cart.removeOne']({ tierName })}
	>
		<Minus class="h-4 w-4" />
	</Button>
	<span class="w-10 text-center text-lg font-bold" aria-live="polite">
		{quantity}
	</span>
	<Button
		variant="outline"
		size="icon"
		onclick={() => onSetQuantity(quantity + 1)}
		disabled={disabled || quantity >= max}
		aria-label={m['cart.addOne']({ tierName })}
	>
		<Plus class="h-4 w-4" />
	</Button>
	{#if max < 100 && quantity > 0}
		<span class="text-sm text-muted-foreground">
			{m['ticketConfirmationDialog.maxHint']({ max })}
		</span>
	{/if}
</div>
