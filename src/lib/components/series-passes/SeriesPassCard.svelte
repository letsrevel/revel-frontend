<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';
	import { seriespassGetSeriesPassQuote } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { createQuery } from '@tanstack/svelte-query';
	import PricingCard from '$lib/components/common/PricingCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatPrice } from '$lib/utils/format';
	import { Ticket, CreditCard, HandCoins } from '@lucide/svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import SeriesPassPurchaseDialog from './SeriesPassPurchaseDialog.svelte';

	interface Props {
		pass: SeriesPassSchema;
		seriesId: string;
		isAuthenticated: boolean;
	}

	const { pass, seriesId, isAuthenticated }: Props = $props();

	let showPurchaseDialog = $state(false);

	// Live pro-rata quote (public endpoint, works for anonymous users too).
	const quoteQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.quote(seriesId, pass.id ?? ''),
		queryFn: async () => {
			const response = await seriespassGetSeriesPassQuote({
				path: { pass_id: pass.id ?? '' }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load pass quote');
			}
			return response.data;
		},
		enabled: !!pass.id
	}));

	const quote = $derived<SeriesPassQuoteSchema | undefined>(quoteQuery.data);

	// Show the season price struck through when the pro-rata discount kicked in.
	const isDiscounted = $derived(
		!!quote && quote.passed_events > 0 && parseFloat(quote.price) < parseFloat(pass.price)
	);

	const currentPrice = $derived(
		quote
			? formatPrice(quote.price, quote.currency, m['seriesPass.free']())
			: formatPrice(pass.price, pass.currency, m['seriesPass.free']())
	);

	const isButtonDisabled = $derived.by(() => {
		const loading = quoteQuery.isLoading;
		const error = quoteQuery.error;
		return loading || !!error;
	});

	function handleBuyClick() {
		if (!isAuthenticated) {
			// The login action reads `returnUrl` (see login/+page.server.ts); include
			// the query string so pagination state survives the round trip.
			const target = window.location.pathname + window.location.search;
			window.location.href = `/login?returnUrl=${encodeURIComponent(target)}`;
			return;
		}
		showPurchaseDialog = true;
	}
</script>

{#snippet badges()}
	<!-- The pre-discount season price, struck through beside the name: the big
	     number below is what the buyer would actually pay today. -->
	{#if isDiscounted}
		<s class="text-sm text-muted-foreground line-through">
			{formatPrice(pass.price, pass.currency, m['seriesPass.free']())}
		</s>
	{/if}
{/snippet}

{#snippet meta()}
	<!-- Coverage / pro-rata line -->
	{#if quote}
		<p class="text-sm text-muted-foreground">
			{m['seriesPass.coverageLine']({
				remaining: quote.remaining_events,
				total: quote.remaining_events + quote.passed_events
			})}
		</p>
	{/if}

	<!-- Payment method hint -->
	{#if pass.payment_method === 'offline' || pass.payment_method === 'at_the_door'}
		<p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
			<HandCoins class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOffline']()}
		</p>
	{:else if pass.payment_method === 'online'}
		<p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
			<CreditCard class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOnline']()}
		</p>
	{/if}
{/snippet}

{#snippet actions()}
	{#if quote && !quote.purchasable}
		<Button class="w-full" disabled>
			{m['seriesPass.notAvailable']()}
		</Button>
		{#if quote.reason}
			<p class="mt-2 text-center text-xs text-muted-foreground" role="status">
				{quote.reason}
			</p>
		{/if}
	{:else}
		<Button class="w-full" onclick={handleBuyClick} disabled={isButtonDisabled}>
			{m['seriesPass.buyButton']()}
		</Button>
	{/if}
{/snippet}

<PricingCard
	name={pass.name}
	icon={Ticket}
	price={currentPrice}
	layout="stack"
	class="h-full border-primary/30"
	{badges}
	{meta}
	{actions}
>
	{#if pass.description}
		<div class="text-sm text-muted-foreground">
			<MarkdownContent content={pass.description} />
		</div>
	{/if}
</PricingCard>

{#if showPurchaseDialog && quote && pass.id}
	<SeriesPassPurchaseDialog
		{pass}
		{quote}
		{seriesId}
		onClose={() => (showPurchaseDialog = false)}
	/>
{/if}
