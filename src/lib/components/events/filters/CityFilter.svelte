<script lang="ts">
	import type { CitySchema } from '$lib/api/generated/types.gen';
	import { MapPin, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { cityListCities } from '$lib/api';

	interface Props {
		selectedCity?: { id: number; name: string; country: string } | null;
		onChangeCity: (city: { id: number; name: string; country: string } | null) => void;
		class?: string;
	}

	let { selectedCity = null, onChangeCity, class: className }: Props = $props();

	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<CitySchema[]>([]);
	let isDropdownOpen = $state(false);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Search cities when query changes
	async function searchCities(query: string): Promise<void> {
		if (query.length < 2) {
			searchResults = [];
			isDropdownOpen = false;
			return;
		}

		isSearching = true;

		try {
			const response = await cityListCities({
				query: {
					search: query,
					page: 1,
					page_size: 10
				}
			});

			if (response.data) {
				searchResults = response.data.results;
				isDropdownOpen = searchResults.length > 0;
			}
		} catch (error) {
			console.error('Failed to search cities:', error);
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}

	function handleInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;

		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		// Debounce search
		debounceTimeout = setTimeout(() => {
			searchCities(searchQuery);
		}, 300);
	}

	function handleSelectCity(city: CitySchema): void {
		if (city.id) {
			onChangeCity({ id: city.id, name: city.name, country: city.country });
			searchQuery = '';
			searchResults = [];
			isDropdownOpen = false;
		}
	}

	function handleClearCity(): void {
		onChangeCity(null);
		searchQuery = '';
		searchResults = [];
		isDropdownOpen = false;
	}

	function handleBlur(): void {
		// Delay to allow click on dropdown items
		setTimeout(() => {
			isDropdownOpen = false;
		}, 200);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Location</h3>
	</div>

	{#if selectedCity}
		<!-- Selected City Display -->
		<div
			class="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
		>
			<div class="flex-1">
				<div class="text-sm font-medium">{selectedCity.name}</div>
				<div class="text-xs text-muted-foreground">{selectedCity.country}</div>
			</div>
			<button
				type="button"
				onclick={handleClearCity}
				class="rounded-sm p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Clear city filter"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	{:else}
		<!-- City Search Input -->
		<div class="relative">
			<div class="relative">
				<MapPin
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					type="text"
					value={searchQuery}
					oninput={handleInput}
					onblur={handleBlur}
					onfocus={() => searchQuery.length >= 2 && searchCities(searchQuery)}
					placeholder="Search for a city..."
					class="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label="Search for a city"
					autocomplete="off"
				/>
			</div>

			<!-- Search Results Dropdown -->
			{#if isDropdownOpen && searchResults.length > 0}
				<div
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover shadow-md"
				>
					{#each searchResults as city (city.id)}
						<button
							type="button"
							onclick={() => handleSelectCity(city)}
							class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
						>
							<MapPin class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<div class="flex-1">
								<div class="font-medium">{city.name}</div>
								<div class="text-xs text-muted-foreground">{city.country}</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}

			<!-- Loading State -->
			{#if isSearching}
				<div class="absolute right-3 top-1/2 -translate-y-1/2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
					></div>
				</div>
			{/if}
		</div>

		<p class="text-xs text-muted-foreground">Filter events by city location</p>
	{/if}
</div>
