<script lang="ts">
	/** Test-only stateful host for CheckoutBillingSection's effect-tracking
	 * tests. testing-library's `rerender` swaps a `$state.raw` props object
	 * behind a proxy, so ANY rerender invalidates EVERY prop read transitively
	 * — an untracked prop is indistinguishable from a tracked one through that
	 * harness. This host owns the pricing inputs as its own `$state` and
	 * mutates them via exported setters WITHOUT a rerender, so only genuinely
	 * tracked reads re-fire the component's effects (matching the real call
	 * site, CheckoutSheet, which passes fine-grained individual props). The
	 * QueryClientProvider lives here too so tests can reach the exports on the
	 * rendered component instance directly. */
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import CheckoutBillingSection from './CheckoutBillingSection.svelte';
	import type { VatPreviewItemSchema } from '$lib/api/generated/types.gen';

	const {
		initialItems,
		initialPwycAmountOverride = null
	}: {
		initialItems?: VatPreviewItemSchema[];
		initialPwycAmountOverride?: string | null;
	} = $props();

	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	let discountCode = $state<string | undefined>(undefined);
	let pwycAmountOverride = $state<string | null>(initialPwycAmountOverride);

	export function setDiscountCode(next: string | undefined): void {
		discountCode = next;
	}
	export function setPwycAmountOverride(next: string | null): void {
		pwycAmountOverride = next;
	}
</script>

<QueryClientProvider {client}>
	<CheckoutBillingSection
		eventId="event-123"
		tierId="tier-456"
		tierName="General Admission"
		quantity={2}
		currency="EUR"
		price="25.00"
		isPwyc={false}
		isAuthenticated={false}
		{discountCode}
		items={initialItems}
		{pwycAmountOverride}
	/>
</QueryClientProvider>
