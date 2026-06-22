<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminrevenueGetOrganizationFinancials } from '$lib/api';
	import type {
		CurrencyFinancialsSchema,
		EventFinancialsSchema,
		OrganizationFinancialsSchema
	} from '$lib/api/generated';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate, formatEventDate } from '$lib/utils/date';
	import CurrencyFinancialsSummary from '$lib/components/financials/CurrencyFinancialsSummary.svelte';
	import PeriodFilter from '$lib/components/financials/PeriodFilter.svelte';
	import type { PeriodValue } from '$lib/components/financials/period';
	import RevenueReportButton from '$lib/components/financials/RevenueReportButton.svelte';
	import { BarChart3, ChevronDown, Loader2, ArrowUpDown } from 'lucide-svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	const slug = $derived(data.organization.slug);

	// All filter/sort state lives in the URL so views are shareable and survive reload.
	const params = $derived.by(() => {
		const sp = $page.url.searchParams;
		const yearRaw = sp.get('year');
		const monthRaw = sp.get('month');
		const quarterRaw = sp.get('quarter');
		return {
			year: yearRaw ? Number(yearRaw) : new Date().getFullYear(),
			month: monthRaw ? Number(monthRaw) : null,
			quarter: quarterRaw ? Number(quarterRaw) : null,
			currency: sp.get('currency'),
			sort: sp.get('sort') === 'event_start' ? 'event_start' : 'revenue',
			order: sp.get('order') === 'asc' ? 'asc' : 'desc'
		};
	});

	const period = $derived<PeriodValue>({
		year: params.year,
		month: params.month,
		quarter: params.quarter
	});

	function updateParams(next: Record<string, string | number | null>) {
		const sp = new URLSearchParams($page.url.searchParams);
		for (const [key, value] of Object.entries(next)) {
			if (value === null || value === '') sp.delete(key);
			else sp.set(key, String(value));
		}
		goto(`?${sp.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function handlePeriodChange(value: PeriodValue) {
		// Reset the currency to the new period's dominant default — a currency
		// carried over from another period may have no sales here, which would
		// otherwise leave the view filtered to an empty currency.
		updateParams({ year: value.year, month: value.month, quarter: value.quarter, currency: null });
	}

	function toggleOrder() {
		updateParams({ order: params.order === 'asc' ? 'desc' : 'asc' });
	}

	const financialsQuery = createQuery<OrganizationFinancialsSchema>(() => ({
		queryKey: ['org-financials', slug, params],
		queryFn: async () => {
			const response = await organizationadminrevenueGetOrganizationFinancials({
				path: { slug },
				query: {
					year: params.year,
					month: params.month,
					quarter: params.quarter,
					currency: params.currency,
					sort: params.sort,
					order: params.order
				}
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load organization financials');
			}
			return response.data;
		}
	}));

	const financials = $derived(financialsQuery.data);
	const activeCurrency = $derived(financials?.active_currency ?? params.currency ?? null);

	// Pick the figures for the currently-active currency, falling back to the first
	// available so a row is never blank when currencies are mixed.
	function entryFor(
		entries: CurrencyFinancialsSchema[],
		currency: string | null
	): CurrencyFinancialsSchema | undefined {
		if (entries.length === 0) return undefined;
		if (!currency) return entries[0];
		return entries.find((entry) => entry.currency === currency) ?? entries[0];
	}

	const totalsEntry = $derived(
		financials ? entryFor(financials.totals, activeCurrency) : undefined
	);

	let expanded = $state<Record<string, boolean>>({});
	function toggleExpanded(eventId: string) {
		expanded[eventId] = !expanded[eventId];
	}

	function eventEntry(event: EventFinancialsSchema): CurrencyFinancialsSchema | undefined {
		return entryFor(event.by_currency, activeCurrency);
	}
</script>

<svelte:head>
	<title>{m['financials.title']()} · {data.organization.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="space-y-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">{m['financials.title']()}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{m['financials.subtitle']()}</p>
		</div>
		<RevenueReportButton {slug} {period} />
	</header>

	<!-- Filters -->
	<div
		class="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-card p-4"
	>
		<PeriodFilter value={period} onChange={handlePeriodChange} />

		<div class="flex flex-wrap items-end gap-3">
			<div class="flex flex-col gap-1">
				<label for="financials-sort" class="text-xs font-medium text-muted-foreground">
					{m['financials.sort.label']()}
				</label>
				<div class="flex gap-2">
					<select
						id="financials-sort"
						value={params.sort}
						onchange={(e) => updateParams({ sort: e.currentTarget.value })}
						class="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<option value="revenue">{m['financials.sort.revenue']()}</option>
						<option value="event_start">{m['financials.sort.eventStart']()}</option>
					</select>
					<button
						type="button"
						onclick={toggleOrder}
						class="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={params.order === 'asc'
							? m['financials.sort.ascending']()
							: m['financials.sort.descending']()}
					>
						<ArrowUpDown class="h-4 w-4" aria-hidden="true" />
						{params.order === 'asc' ? m['financials.sort.asc']() : m['financials.sort.desc']()}
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Currency switcher -->
	{#if financials && financials.available_currencies.length > 1}
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-muted-foreground">{m['financials.currency.label']()}</span>
			{#each financials.available_currencies as currency (currency)}
				<button
					type="button"
					onclick={() => updateParams({ currency })}
					class="rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {activeCurrency ===
					currency
						? 'border-primary bg-primary/10 text-primary'
						: 'border-input bg-background text-muted-foreground hover:bg-accent'}"
					aria-pressed={activeCurrency === currency}
				>
					{currency}
				</button>
			{/each}
		</div>
	{/if}

	{#if financialsQuery.isPending}
		<div class="flex items-center justify-center py-16" role="status">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="ml-2 text-sm text-muted-foreground">{m['financials.loading']()}</span>
		</div>
	{:else if financialsQuery.error}
		<div
			role="alert"
			class="rounded-lg border border-destructive bg-destructive/10 p-6 text-center"
		>
			<p class="text-sm font-medium text-destructive">{m['financials.error']()}</p>
			<button
				type="button"
				onclick={() => financialsQuery.refetch()}
				class="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{m['financials.retry']()}
			</button>
		</div>
	{:else if financials}
		<!-- Period range -->
		<p class="text-sm text-muted-foreground">
			{m['financials.periodRange']({
				from: formatDate(financials.date_from, 'UTC'),
				to: formatDate(financials.date_to, 'UTC')
			})}
		</p>

		<!-- Totals -->
		{#if totalsEntry}
			<div class="rounded-lg border border-border bg-card p-5">
				<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
					{m['financials.totalsHeading']()}
				</h2>
				<CurrencyFinancialsSummary data={totalsEntry} />
			</div>
		{/if}

		<!-- Per-event breakdown -->
		<div>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{m['financials.byEventHeading']()}
			</h2>

			{#if financials.events.length === 0}
				<div class="rounded-lg border border-border bg-card p-12 text-center">
					<BarChart3 class="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
					<h3 class="mt-4 text-lg font-semibold">{m['financials.empty.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">{m['financials.empty.description']()}</p>
				</div>
			{:else}
				<ul class="space-y-2">
					{#each financials.events as event (event.event_id)}
						{@const entry = eventEntry(event)}
						<li class="overflow-hidden rounded-lg border border-border bg-card">
							<button
								type="button"
								onclick={() => toggleExpanded(event.event_id)}
								class="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
								aria-expanded={expanded[event.event_id] ?? false}
							>
								<div class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{event.event_name}</span>
									<span class="text-sm text-muted-foreground">
										{formatEventDate(event.event_start)}
									</span>
								</div>

								<div class="hidden shrink-0 text-right sm:block">
									<span class="block text-xs text-muted-foreground">{m['financials.gross']()}</span>
									<span class="tabular-nums">
										{formatMoney(entry?.gross ?? 0, entry?.currency ?? activeCurrency)}
									</span>
								</div>

								<div class="shrink-0 text-right">
									<span class="block text-xs text-muted-foreground">{m['financials.net']()}</span>
									<span class="font-semibold tabular-nums">
										{formatMoney(entry?.net ?? 0, entry?.currency ?? activeCurrency)}
									</span>
								</div>

								<ChevronDown
									class="h-5 w-5 shrink-0 text-muted-foreground transition-transform {expanded[
										event.event_id
									]
										? 'rotate-180'
										: ''}"
									aria-hidden="true"
								/>
							</button>

							{#if expanded[event.event_id]}
								<div class="border-t border-border bg-muted/20 p-4">
									{#if entry}
										<CurrencyFinancialsSummary data={entry} />
									{:else}
										<p class="text-sm text-muted-foreground">
											{m['financials.noFiguresForCurrency']()}
										</p>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>
