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
	}

	const { count, totalDisplay, currency, isFree, isPending, onBuy }: Props = $props();
</script>

<div
	class="fixed inset-x-0 bottom-0 z-40 border-t-2 bg-card pb-[env(safe-area-inset-bottom)] shadow-poster"
	role="region"
	aria-label={m['cart.summaryRegion']()}
	data-testid="cart-summary-bar"
>
	<div class="container mx-auto flex items-center justify-between gap-4 px-6 py-3 md:px-8">
		<p class="text-sm font-bold" aria-live="polite">
			{m['cart.ticketCount']({ count })}
			{#if isFree}
				<span class="text-muted-foreground">· {m['cart.free']()}</span>
			{:else if totalDisplay !== null}
				<span class="text-muted-foreground">· {currency} {totalDisplay}</span>
			{/if}
		</p>
		<Button onclick={onBuy} disabled={isPending || count === 0} class="min-w-28">
			{#if isPending}
				<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
			{/if}
			{m['cart.buy']()}
		</Button>
	</div>
</div>
