<script lang="ts">
	/** Sticky cart summary (#853): count + running total + one Buy button.
	 * z-40 keeps it under bits-ui dialog overlays (z-50). */
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { LoaderCircle } from '@lucide/svelte';

	interface Props {
		count: number;
		totalDisplay: string | null;
		currency: string | null;
		isFree: boolean;
		isPending: boolean;
		onBuy: () => void;
		/** Sheet entry point for the discount code (PR 2). Bar renders no link
		 * when omitted — callers that never mount the sheet stay unaffected. */
		onDiscountClick?: () => void;
	}

	const { count, totalDisplay, currency, isFree, isPending, onBuy, onDiscountClick }: Props =
		$props();
</script>

<div
	class="fixed inset-x-0 bottom-0 z-40 border-t-2 bg-card pb-[env(safe-area-inset-bottom)] shadow-poster"
	role="region"
	aria-label={m['cart.summaryRegion']()}
	data-testid="cart-summary-bar"
>
	<div class="container mx-auto flex items-center justify-between gap-4 px-6 py-3 md:px-8">
		<div class="min-w-0">
			<p class="text-sm font-bold" aria-live="polite">
				{m['cart.ticketCount']({ count })}
				{#if isFree}
					<span class="text-muted-foreground">· {m['cart.free']()}</span>
				{:else if totalDisplay !== null}
					<span class="text-muted-foreground">· {currency} {totalDisplay}</span>
				{/if}
			</p>
			{#if onDiscountClick}
				<button
					type="button"
					onclick={onDiscountClick}
					class="text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['cart.discountLink']()}
				</button>
			{/if}
		</div>
		<Button onclick={onBuy} disabled={isPending || count === 0} class="min-w-28">
			{#if isPending}
				<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
			{/if}
			{m['cart.buy']()}
		</Button>
	</div>
</div>
