<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';
	import { seriespassGetSeriesPassQuote } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { createQuery } from '@tanstack/svelte-query';
	import { Card } from '$lib/components/ui/card';
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

<Card class="flex flex-col gap-4 border-primary/30 p-4 md:p-6">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<Ticket class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
				<h3 class="truncate text-lg font-semibold">{pass.name}</h3>
			</div>
			{#if pass.description}
				<div class="mt-2 text-sm text-muted-foreground">
					<MarkdownContent content={pass.description} />
				</div>
			{/if}
		</div>

		<!-- Price block -->
		<div class="shrink-0 text-right">
			{#if isDiscounted}
				<p class="text-sm text-muted-foreground line-through">
					{formatPrice(pass.price, pass.currency, m['seriesPass.free']())}
				</p>
			{/if}
			<p class="text-2xl font-bold text-primary">{currentPrice}</p>
		</div>
	</div>

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
		<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<HandCoins class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOffline']()}
		</p>
	{:else if pass.payment_method === 'online'}
		<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<CreditCard class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOnline']()}
		</p>
	{/if}

	<!-- CTA -->
	<div class="mt-auto">
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
			<Button
				class="w-full"
				onclick={handleBuyClick}
				disabled={quoteQuery.isLoading || !!quoteQuery.error}
			>
				{m['seriesPass.buyButton']()}
			</Button>
		{/if}
	</div>
</Card>

{#if showPurchaseDialog && quote && pass.id}
	<SeriesPassPurchaseDialog
		{pass}
		{quote}
		{seriesId}
		onClose={() => (showPurchaseDialog = false)}
	/>
{/if}
