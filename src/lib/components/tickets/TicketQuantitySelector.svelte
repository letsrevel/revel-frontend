<script lang="ts">
	/** Quantity stepper for the authenticated purchase dialog (guest flows have
	 * their own GuestTicketQuantitySelector with price context). */
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Minus, Plus } from '@lucide/svelte';

	interface Props {
		quantity: number;
		effectiveMaxQuantity: number;
		isProcessing: boolean;
		onIncrement: () => void;
		onDecrement: () => void;
	}

	const { quantity, effectiveMaxQuantity, isProcessing, onIncrement, onDecrement }: Props =
		$props();
</script>

<div class="space-y-2">
	<Label>{m['ticketConfirmationDialog.numberOfTickets']()}</Label>
	<div class="flex items-center gap-3">
		<Button
			variant="outline"
			size="icon"
			onclick={onDecrement}
			disabled={quantity <= 1 || isProcessing}
			aria-label={m['ticketConfirmationDialog.decreaseQuantity']()}
		>
			<Minus class="h-4 w-4" />
		</Button>
		<span class="w-12 text-center text-xl font-bold">{quantity}</span>
		<Button
			variant="outline"
			size="icon"
			onclick={onIncrement}
			disabled={quantity >= effectiveMaxQuantity || isProcessing}
			aria-label={m['ticketConfirmationDialog.increaseQuantity']()}
		>
			<Plus class="h-4 w-4" />
		</Button>
		{#if effectiveMaxQuantity < 100}
			<span class="text-sm text-muted-foreground">
				{m['ticketConfirmationDialog.maxHint']({ max: effectiveMaxQuantity })}
			</span>
		{/if}
	</div>
</div>
