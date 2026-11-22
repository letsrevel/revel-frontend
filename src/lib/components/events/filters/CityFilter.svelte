<script lang="ts">
	import type { CitySchema } from '$lib/api/generated/types.gen';
	import { MapPin, X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { cityGetCity, cityListCities } from '$lib/api';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as m from '$lib/paraglide/messages.js';

	type SelectedCity = { id: number; name: string; country: string };

	interface Props {
		/** The `city_id` filter. The URL holds only the ID, so we load the name. */
		selectedCityId?: number | null;
		onChangeCity: (city: SelectedCity | null) => void;
		class?: string;
	}

	const { selectedCityId = null, onChangeCity, class: className }: Props = $props();

	const queryClient = useQueryClient();

	/** The queryFn throws `{ status }`; a network failure throws an Error instead. */
	function isNotFound(error: unknown): boolean {
		return !!error && typeof error === 'object' && 'status' in error && error.status === 404;
	}

	function cityQueryKey(id: number): ['city', number] {
		return ['city', id];
	}

	// A city never changes, so keep it for the session. A pick from the search
	// list seeds this cache (handleSelectCity), so the name shows at once.
	const cityQuery = createQuery(() => ({
		queryKey: cityQueryKey(selectedCityId ?? 0),
		queryFn: async (): Promise<SelectedCity> => {
			const id = selectedCityId as number;
			const { data, response } = await cityGetCity({ path: { city_id: id } });
			// Carry the status so the global retry policy fails a 404 at once.
			if (!data) throw { status: response?.status };
			return { id, name: data.name, country: data.country };
		},
		enabled: !!selectedCityId,
		staleTime: Infinity
	}));

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
			const picked: SelectedCity = { id: city.id, name: city.name, country: city.country };
			queryClient.setQueryData(cityQueryKey(city.id), picked);
			onChangeCity(picked);
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
		<h3 class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
			{m['filters.city.heading']()}
		</h3>
	</div>

	{#if selectedCityId}
		<!-- Selected City Display -->
		<div
			class="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
		>
			<!-- One live region for the whole box, so the change from "loading" to the
			     city name is announced. -->
			<div class="flex-1" role="status">
				{#if cityQuery.data}
					<div class="text-sm font-medium">{cityQuery.data.name}</div>
					<div class="text-xs text-muted-foreground">{cityQuery.data.country}</div>
				{:else if cityQuery.isError}
					<!-- 404 (for example an old link) or another failure: say which.
					     The filter is still on and the user can clear it. -->
					<div class="text-sm font-medium">
						{isNotFound(cityQuery.error)
							? m['filters.city.unknown']()
							: m['filters.city.loadError']()}
					</div>
				{:else}
					<div class="space-y-1.5">
						<span class="sr-only">{m['filters.city.loading']()}</span>
						<div class="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true"></div>
						<div class="h-3 w-16 animate-pulse rounded bg-muted" aria-hidden="true"></div>
					</div>
				{/if}
			</div>
			<button
				type="button"
				onclick={handleClearCity}
				class="rounded-sm p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label={m['filters.city.clear']()}
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
					placeholder={m['filters.city.placeholder']()}
					class="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label={m['filters.city.label']()}
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

		<p class="text-xs text-muted-foreground">{m['filters.city.description']()}</p>
	{/if}
</div>
