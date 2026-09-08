<script lang="ts">
	/**
	 * Org-wide "Sales by source" breakdown (#880 follow-up). Originally lived
	 * inline on `/admin/tickets`; moved here as a collapsed-by-default
	 * disclosure so the tickets tab goes back to being just an event picker.
	 * Self-contained: owns its own `<details>`, URL-param filters (`since`,
	 * repeated `event_ids`), and the two client-side queries backing it.
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { z } from 'zod';
	import { ChevronDown } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import SalesBySourceCard from '$lib/components/tickets/SalesBySourceCard.svelte';
	import {
		sinceForPreset,
		presetForSince,
		SELECTABLE_SINCE_PRESETS,
		type SincePreset
	} from '$lib/utils/attribution-presets';
	import { sortTicketEventsForPicker } from '$lib/utils/ticket-event-picker';
	import {
		eventpublicdiscoveryListEvents,
		organizationadminticketsTicketAttributionBreakdown
	} from '$lib/api';

	interface Props {
		/** Organization slug — path param for the attribution-breakdown endpoint. */
		slug: string;
		/** Organization id — query param for the ticketed-events list. */
		organizationId: string;
	}
	const { slug, organizationId }: Props = $props();

	let expanded = $state(false);
	// Gate both queries on the disclosure having been opened at least once, so a
	// staff member who never opens this section never pays for either request.
	// One-directional like `SalesBySourceCard`'s own auto-open effect: closing
	// again must not un-fetch what's already loaded.
	let hasOpened = $state(false);
	$effect(() => {
		if (expanded) hasOpened = true;
	});

	const since = $derived.by(() => {
		const raw = $page.url.searchParams.get('since');
		return raw !== null && Number.isFinite(new Date(raw).getTime()) ? raw : null;
	});
	const eventIds = $derived(
		$page.url.searchParams
			.getAll('event_ids')
			.filter((id) => z.string().uuid().safeParse(id).success)
	);
	const activePreset = $derived(presetForSince(since));

	/** Mutates a clone of the current URL and navigates to it, preserving
	 * every param this section doesn't touch. */
	function updateUrl(mutate: (url: URL) => void) {
		const url = new URL($page.url);
		mutate(url);
		const query = url.searchParams.toString();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative path+"?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`${url.pathname}${query ? `?${query}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectSincePreset(preset: SincePreset) {
		updateUrl((url) => {
			url.searchParams.delete('since');
			const iso = sinceForPreset(preset);
			if (iso) url.searchParams.set('since', iso);
		});
	}

	function toggleEventFilter(eventId: string, checked: boolean) {
		updateUrl((url) => {
			const next = checked ? [...eventIds, eventId] : eventIds.filter((id) => id !== eventId);
			url.searchParams.delete('event_ids');
			for (const id of next) url.searchParams.append('event_ids', id);
		});
	}

	function sincePresetLabel(preset: SincePreset): string {
		switch (preset) {
			case 'all':
				return m['orgAdmin.tickets.salesBySource.sincePresetAll']();
			case 'last7':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast7']();
			case 'last30':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast30']();
			case 'last90':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast90']();
			case 'thisYear':
				return m['orgAdmin.tickets.salesBySource.sincePresetThisYear']();
			case 'custom':
				return m['orgAdmin.tickets.salesBySource.sincePresetCustom']();
		}
	}

	const eventsQuery = createQuery(() => ({
		queryKey: ['org-attribution-events', organizationId],
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					organization: organizationId,
					requires_ticket: true,
					include_past: true,
					next_events: false,
					page_size: 100
				}
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load ticketed events');
			}
			return sortTicketEventsForPicker(response.data.results ?? []);
		},
		enabled: hasOpened
	}));

	const breakdownQuery = createQuery(() => ({
		queryKey: ['org-attribution', slug, since, eventIds],
		queryFn: async () => {
			const response = await organizationadminticketsTicketAttributionBreakdown({
				path: { slug },
				query: {
					since: since ?? undefined,
					event_ids: eventIds.length > 0 ? eventIds : undefined
				}
			});
			if (response.error) {
				throw new Error('Failed to load attribution breakdown');
			}
			return response.data ?? [];
		},
		enabled: hasOpened
	}));

	const events = $derived(eventsQuery.data ?? []);
	const buckets = $derived(breakdownQuery.data ?? null);
	const bucketCount = $derived(buckets?.length ?? 0);
	// True both when a filter narrows an otherwise non-empty breakdown down to
	// nothing, and when the org simply has no completed sales yet — the
	// backend returns `[]` for both, and "No results for these filters" reads
	// fine either way.
	const isEmpty = $derived(breakdownQuery.isSuccess && buckets !== null && buckets.length === 0);
	const eventFilterLabel = $derived(
		eventIds.length === 0
			? m['orgAdmin.tickets.salesBySource.eventFilterAll']()
			: m['orgAdmin.tickets.salesBySource.eventFilterCount']({ count: eventIds.length })
	);
</script>

<details class="group rounded-lg border border-border bg-card" bind:open={expanded}>
	<summary
		class="flex cursor-pointer list-none items-center justify-between gap-2 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
	>
		<h2 class="text-lg font-bold">{m['orgAdmin.tickets.salesBySource.title']()}</h2>
		<ChevronDown
			class="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
			aria-hidden="true"
		/>
	</summary>

	<div class="space-y-4 border-t border-border p-4">
		<div class="flex flex-wrap items-center gap-3">
			<Select.Root
				type="single"
				value={activePreset === 'custom' ? '' : activePreset}
				onValueChange={(v) => {
					if (v) selectSincePreset(v as SincePreset);
				}}
			>
				<Select.Trigger
					class="w-full sm:w-52"
					aria-label={m['orgAdmin.tickets.salesBySource.sinceAriaLabel']()}
				>
					{sincePresetLabel(activePreset)}
				</Select.Trigger>
				<Select.Content>
					{#each SELECTABLE_SINCE_PRESETS as preset (preset)}
						<Select.Item value={preset}>{sincePresetLabel(preset)}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							class="gap-2"
							aria-label={m['orgAdmin.tickets.salesBySource.eventFilterAriaLabel']()}
						>
							{eventFilterLabel}
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-64">
					{#each events as event (event.id)}
						<DropdownMenu.CheckboxItem
							checked={eventIds.includes(event.id)}
							onCheckedChange={(checked) => toggleEventFilter(event.id, checked)}
						>
							{event.name}
						</DropdownMenu.CheckboxItem>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>

		<!-- Announces the visible bucket-row count whenever the since/event
		     filters change what the card shows (WCAG 4.1.3). -->
		<div role="status" aria-live="polite" class="sr-only">
			{m['orgAdmin.tickets.salesBySource.resultsAnnouncement']({ count: bucketCount })}
		</div>

		{#if breakdownQuery.isError}
			<p class="text-sm text-muted-foreground">{m['financials.error']()}</p>
		{:else if isEmpty}
			<p class="text-sm text-muted-foreground">{m['orgAdmin.tickets.salesBySource.noResults']()}</p>
		{:else if buckets && buckets.length > 0}
			<SalesBySourceCard
				{buckets}
				currentUrl={$page.url}
				filterable={false}
				showHeading={false}
				collapsible={false}
			/>
		{:else if breakdownQuery.isPending && hasOpened}
			<p class="text-sm text-muted-foreground">{m['financials.loading']()}</p>
		{/if}
	</div>
</details>
