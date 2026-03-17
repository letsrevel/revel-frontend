<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventpublicdiscoveryListEvents,
		eventseriesListEventSeries,
		eventadminticketsListTicketTiers
	} from '$lib/api/generated/sdk.gen';
	import type {
		EventInListSchema,
		EventSeriesInListSchema,
		TicketTierDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Check, Search, ChevronDown } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		organizationId: string;
		selectedSeriesIds?: string[];
		selectedEventIds?: string[];
		selectedTierIds?: string[];
		onSeriesChange?: (ids: string[]) => void;
		onEventsChange?: (ids: string[]) => void;
		onTiersChange?: (ids: string[]) => void;
		disabled?: boolean;
	}

	const {
		organizationId,
		selectedSeriesIds = [],
		selectedEventIds = [],
		selectedTierIds = [],
		onSeriesChange,
		onEventsChange,
		onTiersChange,
		disabled = false
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Section expand state
	let seriesOpen = $state(selectedSeriesIds.length > 0);
	let eventsOpen = $state(selectedEventIds.length > 0);
	let tiersOpen = $state(selectedTierIds.length > 0);

	// Search state
	let seriesSearch = $state('');
	let eventsSearch = $state('');
	let tiersSearch = $state('');

	// Local selection sets
	let seriesSet = $state(new Set(selectedSeriesIds));
	let eventsSet = $state(new Set(selectedEventIds));
	let tiersSet = $state(new Set(selectedTierIds));

	// Sync with prop changes
	$effect(() => {
		seriesSet = new Set(selectedSeriesIds);
	});
	$effect(() => {
		eventsSet = new Set(selectedEventIds);
	});
	$effect(() => {
		tiersSet = new Set(selectedTierIds);
	});

	// Fetch series
	const seriesQuery = createQuery<EventSeriesInListSchema[]>(() => ({
		queryKey: ['org-series-for-scope', organizationId],
		queryFn: async () => {
			const response = await eventseriesListEventSeries({
				query: { organization: organizationId, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load series');
			return response.data?.results || [];
		}
	}));

	// Fetch events (only ticketed — discount codes don't apply to RSVP-only events)
	const eventsQuery = createQuery<EventInListSchema[]>(() => ({
		queryKey: ['org-events-for-scope', organizationId],
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: { organization: organizationId, requires_ticket: true, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load events');
			return response.data?.results || [];
		}
	}));

	// Fetch tiers for selected events
	const tiersQuery = createQuery<TicketTierDetailSchema[]>(() => ({
		queryKey: ['tiers-for-scope', ...Array.from(eventsSet).sort()],
		queryFn: async () => {
			const eventIds = Array.from(eventsSet);
			if (eventIds.length === 0) return [];

			const allTiers: TicketTierDetailSchema[] = [];
			for (const eventId of eventIds) {
				const response = await eventadminticketsListTicketTiers({
					path: { event_id: eventId },
					query: { page_size: 100 },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.data?.results) {
					allTiers.push(...response.data.results);
				}
			}
			return allTiers;
		},
		enabled: eventsSet.size > 0
	}));

	// Filtered lists
	const filteredSeries = $derived.by(() => {
		const items = seriesQuery.data || [];
		if (!seriesSearch.trim()) return items;
		const q = seriesSearch.toLowerCase();
		return items.filter((s) => s.name.toLowerCase().includes(q));
	});

	const filteredEvents = $derived.by(() => {
		const items = eventsQuery.data || [];
		if (!eventsSearch.trim()) return items;
		const q = eventsSearch.toLowerCase();
		return items.filter((e) => e.name.toLowerCase().includes(q));
	});

	const filteredTiers = $derived.by(() => {
		const items = tiersQuery.data || [];
		if (!tiersSearch.trim()) return items;
		const q = tiersSearch.toLowerCase();
		return items.filter((t) => t.name.toLowerCase().includes(q));
	});

	// Find event name by id for tier display
	function getEventName(eventId: string | undefined): string {
		if (!eventId) return 'Unknown event';
		const event = eventsQuery.data?.find((e) => e.id === eventId);
		return event?.name || 'Unknown event';
	}

	// Toggle functions
	function toggleSeries(id: string) {
		if (disabled) return;
		const newSet = new Set(seriesSet);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		seriesSet = newSet;
		onSeriesChange?.(Array.from(newSet));
	}

	function toggleEvent(id: string) {
		if (disabled) return;
		const newSet = new Set(eventsSet);
		if (newSet.has(id)) {
			newSet.delete(id);
			// Remove tiers belonging to this event
			const eventTiers = tiersQuery.data?.filter((t) => t.event_id === id) || [];
			const newTierSet = new Set(tiersSet);
			for (const tier of eventTiers) {
				if (tier.id) newTierSet.delete(tier.id);
			}
			tiersSet = newTierSet;
			onTiersChange?.(Array.from(newTierSet));
		} else {
			newSet.add(id);
		}
		eventsSet = newSet;
		onEventsChange?.(Array.from(newSet));
	}

	function toggleTier(id: string) {
		if (disabled) return;
		const newSet = new Set(tiersSet);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		tiersSet = newSet;
		onTiersChange?.(Array.from(newSet));
	}

	// Prune orphan tier IDs when available tiers change (e.g. after event deselected and tiers re-fetched)
	$effect(() => {
		if (!tiersQuery.data) return;
		const validTierIds = new Set(tiersQuery.data.map((t) => t.id).filter(Boolean));
		const pruned = new Set([...tiersSet].filter((id) => validTierIds.has(id)));
		if (pruned.size !== tiersSet.size) {
			tiersSet = pruned;
			onTiersChange?.(Array.from(pruned));
		}
	});

	const hasAnyScope = $derived(seriesSet.size > 0 || eventsSet.size > 0 || tiersSet.size > 0);
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-sm font-medium">Restrict to specific scope</h3>
		<p class="mt-1 text-xs text-muted-foreground">
			{#if hasAnyScope}
				Discount applies to selected items only (union logic).
			{:else}
				Leave all empty for org-wide applicability.
			{/if}
		</p>
	</div>

	<!-- Series Section -->
	<div class="rounded-md border">
		<button
			type="button"
			onclick={() => (seriesOpen = !seriesOpen)}
			class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
			aria-expanded={seriesOpen}
		>
			<span>
				Event Series
				{#if seriesSet.size > 0}
					<span class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
						{seriesSet.size}
					</span>
				{/if}
			</span>
			<ChevronDown
				class={cn('h-4 w-4 transition-transform', seriesOpen && 'rotate-180')}
				aria-hidden="true"
			/>
		</button>

		{#if seriesOpen}
			<div class="border-t px-4 py-3">
				<div class="relative mb-3">
					<Search
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						bind:value={seriesSearch}
						placeholder="Search series..."
						{disabled}
						class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Search event series"
					/>
				</div>

				<div class="max-h-48 overflow-y-auto" role="group" aria-label="Event series">
					{#if seriesQuery.isLoading}
						<div class="flex items-center justify-center py-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
							></div>
						</div>
					{:else if filteredSeries.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No series found</p>
					{:else}
						<ul class="space-y-1">
							{#each filteredSeries as series (series.id)}
								<li>
									<button
										type="button"
										onclick={() => series.id && toggleSeries(series.id)}
										{disabled}
										class={cn(
											'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
											seriesSet.has(series.id || '') && 'bg-primary/5'
										)}
										role="checkbox"
										aria-checked={seriesSet.has(series.id || '')}
									>
										<div
											class={cn(
												'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
												seriesSet.has(series.id || '')
													? 'border-primary bg-primary'
													: 'border-input'
											)}
										>
											{#if seriesSet.has(series.id || '')}
												<Check class="h-3 w-3 text-primary-foreground" aria-hidden="true" />
											{/if}
										</div>
										<span class="truncate">{series.name}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Events Section -->
	<div class="rounded-md border">
		<button
			type="button"
			onclick={() => (eventsOpen = !eventsOpen)}
			class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
			aria-expanded={eventsOpen}
		>
			<span>
				Events
				{#if eventsSet.size > 0}
					<span class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
						{eventsSet.size}
					</span>
				{/if}
			</span>
			<ChevronDown
				class={cn('h-4 w-4 transition-transform', eventsOpen && 'rotate-180')}
				aria-hidden="true"
			/>
		</button>

		{#if eventsOpen}
			<div class="border-t px-4 py-3">
				<div class="relative mb-3">
					<Search
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						bind:value={eventsSearch}
						placeholder="Search events..."
						{disabled}
						class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Search events"
					/>
				</div>

				<div class="max-h-48 overflow-y-auto" role="group" aria-label="Events">
					{#if eventsQuery.isLoading}
						<div class="flex items-center justify-center py-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
							></div>
						</div>
					{:else if filteredEvents.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No events found</p>
					{:else}
						<ul class="space-y-1">
							{#each filteredEvents as event (event.id)}
								<li>
									<button
										type="button"
										onclick={() => event.id && toggleEvent(event.id)}
										{disabled}
										class={cn(
											'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
											eventsSet.has(event.id || '') && 'bg-primary/5'
										)}
										role="checkbox"
										aria-checked={eventsSet.has(event.id || '')}
									>
										<div
											class={cn(
												'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
												eventsSet.has(event.id || '') ? 'border-primary bg-primary' : 'border-input'
											)}
										>
											{#if eventsSet.has(event.id || '')}
												<Check class="h-3 w-3 text-primary-foreground" aria-hidden="true" />
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate">{event.name}</p>
											{#if event.start}
												<p class="text-xs text-muted-foreground">
													{new Date(event.start).toLocaleDateString('en-US', {
														year: 'numeric',
														month: 'short',
														day: 'numeric'
													})}
												</p>
											{/if}
										</div>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Tiers Section (only if events selected) -->
	{#if eventsSet.size > 0}
		<div class="rounded-md border">
			<button
				type="button"
				onclick={() => (tiersOpen = !tiersOpen)}
				class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
				aria-expanded={tiersOpen}
			>
				<span>
					Ticket Tiers
					{#if tiersSet.size > 0}
						<span class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
							{tiersSet.size}
						</span>
					{/if}
				</span>
				<ChevronDown
					class={cn('h-4 w-4 transition-transform', tiersOpen && 'rotate-180')}
					aria-hidden="true"
				/>
			</button>

			{#if tiersOpen}
				<div class="border-t px-4 py-3">
					<div class="relative mb-3">
						<Search
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							type="search"
							bind:value={tiersSearch}
							placeholder="Search tiers..."
							{disabled}
							class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Search ticket tiers"
						/>
					</div>

					<div class="max-h-48 overflow-y-auto" role="group" aria-label="Ticket tiers">
						{#if tiersQuery.isLoading}
							<div class="flex items-center justify-center py-4">
								<div
									class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
								></div>
							</div>
						{:else if filteredTiers.length === 0}
							<p class="py-4 text-center text-sm text-muted-foreground">No tiers found</p>
						{:else}
							<ul class="space-y-1">
								{#each filteredTiers as tier (tier.id)}
									<li>
										<button
											type="button"
											onclick={() => tier.id && toggleTier(tier.id)}
											{disabled}
											class={cn(
												'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
												tiersSet.has(tier.id || '') && 'bg-primary/5'
											)}
											role="checkbox"
											aria-checked={tiersSet.has(tier.id || '')}
										>
											<div
												class={cn(
													'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
													tiersSet.has(tier.id || '') ? 'border-primary bg-primary' : 'border-input'
												)}
											>
												{#if tiersSet.has(tier.id || '')}
													<Check class="h-3 w-3 text-primary-foreground" aria-hidden="true" />
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate">{tier.name}</p>
												<p class="text-xs text-muted-foreground">
													{getEventName(tier.event_id)}
													{#if tier.price}
														&middot; {tier.currency} {tier.price}
													{/if}
												</p>
											</div>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
