<script lang="ts">
	/** Focused "Get tickets" frame around the inline tier list (#853 follow-up):
	 * the sidebar CTA opens this instead of scrolling to `#ticket-tiers`. The
	 * body hosts the SAME `TicketTierList` render the page shows inline (passed
	 * as a snippet — one source of truth, shared cart), and the footer mirrors
	 * `CartSummaryBar` (count · total + Buy). Buy closes the dialog first so the
	 * checkout sheet never stacks on top of it. */
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { LoaderCircle } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		/** Footer props mirror CartSummaryBar's surface — same cart reads. */
		count: number;
		totalDisplay: string | null;
		currency: string | null;
		isFree: boolean;
		isPending: boolean;
		/** Same hand-off as the bar's Buy (`purchaseFlow.handleCartBuy`). */
		onCheckout: () => void;
		children: Snippet;
	}

	let {
		open = $bindable(),
		count,
		totalDisplay,
		currency,
		isFree,
		isPending,
		onCheckout,
		children
	}: Props = $props();

	function handleBuy(): void {
		open = false;
		onCheckout();
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl"
		data-testid="ticket-tiers-dialog"
	>
		<DialogHeader class="border-b px-6 py-4 text-left">
			<DialogTitle>{m['actionButton.getTickets']()}</DialogTitle>
		</DialogHeader>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
			{@render children()}
		</div>

		<DialogFooter class="flex-row items-center justify-between gap-4 border-t px-6 py-3">
			<p class="min-w-0 text-sm font-bold" aria-live="polite">
				{m['cart.ticketCount']({ count })}
				{#if isFree}
					<span class="text-muted-foreground">· {m['cart.free']()}</span>
				{:else if totalDisplay !== null}
					<span class="text-muted-foreground">· {currency} {totalDisplay}</span>
				{/if}
			</p>
			<Button onclick={handleBuy} disabled={isPending || count === 0} class="min-w-28">
				{#if isPending}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['cart.buy']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
