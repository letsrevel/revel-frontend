<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminListVenues } from '$lib/api/generated/sdk.gen';
	import type { VenueDetailSchema, VenueSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Building2, ChevronDown, X, MapPin, Users } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		organizationSlug: string;
		selectedVenue: VenueSchema | null;
		onSelect: (venue: VenueDetailSchema | null) => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		organizationSlug,
		selectedVenue,
		onSelect,
		disabled = false,
		class: className
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Dropdown state
	let isOpen = $state(false);
	let searchQuery = $state('');

	// Fetch venues from the organization
	const venuesQuery = createQuery<VenueDetailSchema[]>(() => ({
		queryKey: ['organization-venues', organizationSlug],
		queryFn: async () => {
			const response = await organizationadminListVenues({
				path: { slug: organizationSlug },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load venues');
			}

			return response.data?.results || [];
		},
		enabled: !!accessToken
	}));

	// Filter venues based on search query
	let filteredVenues = $derived.by(() => {
		const venues = venuesQuery.data || [];
		if (!searchQuery.trim()) return venues;

		const query = searchQuery.toLowerCase().trim();
		return venues.filter(
			(venue) =>
				venue.name.toLowerCase().includes(query) ||
				venue.address?.toLowerCase().includes(query) ||
				venue.city?.name?.toLowerCase().includes(query)
		);
	});

	function handleSelect(venue: VenueDetailSchema | null) {
		onSelect(venue);
		isOpen = false;
		searchQuery = '';
	}

	function handleClear(e: Event) {
		e.stopPropagation();
		onSelect(null);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			isOpen = false;
		}
	}

	// Format city display
	function formatCity(venue: VenueDetailSchema): string {
		if (!venue.city) return venue.address || '';
		const parts = [venue.city.name];
		if (venue.city.country) parts.push(venue.city.country);
		if (venue.address) return `${venue.address}, ${parts.join(', ')}`;
		return parts.join(', ');
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={cn('relative', className)}>
	<label class="mb-1.5 block text-sm font-medium">
		<span class="flex items-center gap-2">
			<Building2 class="h-4 w-4" aria-hidden="true" />
			{m['venueSelector.label']?.() ?? 'Venue'}
		</span>
	</label>

	<!-- Trigger button -->
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		{disabled}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		class={cn(
			'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors',
			'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
			'disabled:cursor-not-allowed disabled:opacity-50',
			isOpen && 'border-ring ring-2 ring-ring ring-offset-2'
		)}
	>
		{#if selectedVenue}
			<span class="flex items-center gap-2 truncate">
				<Building2 class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
				<span class="truncate font-medium">{selectedVenue.name}</span>
			</span>
			<button
				type="button"
				onclick={handleClear}
				class="ml-2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={m['venueSelector.clear']?.() ?? 'Clear venue selection'}
			>
				<X class="h-4 w-4" />
			</button>
		{:else}
			<span class="text-muted-foreground">
				{m['venueSelector.placeholder']?.() ?? 'Select a venue...'}
			</span>
			<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		{/if}
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
			role="listbox"
			aria-label={m['venueSelector.selectVenue']?.() ?? 'Select a venue'}
		>
			<!-- Search input -->
			<div class="border-b p-2">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder={m['venueSelector.searchPlaceholder']?.() ?? 'Search venues...'}
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<!-- Venue list -->
			<div class="max-h-64 overflow-y-auto p-1">
				{#if venuesQuery.isLoading}
					<div class="flex items-center justify-center py-6">
						<div
							class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
						></div>
					</div>
				{:else if venuesQuery.error}
					<div class="py-4 text-center text-sm text-destructive">
						{m['venueSelector.error']?.() ?? 'Failed to load venues'}
					</div>
				{:else if filteredVenues.length === 0}
					<div class="py-4 text-center text-sm text-muted-foreground">
						{searchQuery
							? (m['venueSelector.noResults']?.() ?? 'No venues found')
							: (m['venueSelector.empty']?.() ?? 'No venues available')}
					</div>
				{:else}
					<!-- Option to clear selection -->
					{#if selectedVenue}
						<button
							type="button"
							onclick={() => handleSelect(null)}
							class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
							role="option"
							aria-selected="false"
						>
							<X class="h-4 w-4" aria-hidden="true" />
							{m['venueSelector.clearSelection']?.() ?? 'Clear selection (manual address)'}
						</button>
					{/if}

					{#each filteredVenues as venue (venue.id)}
						<button
							type="button"
							onclick={() => handleSelect(venue)}
							class={cn(
								'flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
								selectedVenue?.id === venue.id && 'bg-accent'
							)}
							role="option"
							aria-selected={selectedVenue?.id === venue.id}
						>
							<span class="flex items-center gap-2 font-medium">
								<Building2 class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
								{venue.name}
							</span>
							<span class="flex items-center gap-4 text-xs text-muted-foreground">
								{#if venue.city || venue.address}
									<span class="flex items-center gap-1">
										<MapPin class="h-3 w-3" aria-hidden="true" />
										{formatCity(venue)}
									</span>
								{/if}
								{#if venue.capacity}
									<span class="flex items-center gap-1">
										<Users class="h-3 w-3" aria-hidden="true" />
										{venue.capacity}
									</span>
								{/if}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<p class="mt-1 text-xs text-muted-foreground">
		{m['venueSelector.help']?.() ?? 'Select a pre-configured venue or enter address manually below'}
	</p>
</div>

<!-- Click outside to close -->
{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-transparent"
		onclick={() => (isOpen = false)}
		aria-hidden="true"
		tabindex="-1"
	></button>
{/if}
