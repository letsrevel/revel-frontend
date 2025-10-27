<script lang="ts">
	import { cityListCities } from '$lib/api/generated';
	import type { CitySchema } from '$lib/api/generated';
	import { Search, X, Loader2, MapPin } from 'lucide-svelte';

	interface Props {
		value: CitySchema | null;
		onSelect: (city: CitySchema | null) => void;
		disabled?: boolean;
		error?: string;
		label?: string;
		description?: string;
	}

	let {
		value,
		onSelect,
		disabled = false,
		error,
		label = 'Preferred City',
		description = 'Select your preferred city for event recommendations'
	}: Props = $props();

	// Component state
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<CitySchema[]>([]);
	let showDropdown = $state(false);
	let selectedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputElement = $state<HTMLInputElement | null>(null);

	// Format city for display
	function formatCity(city: CitySchema): string {
		const parts = [city.name];
		if (city.admin_name) parts.push(city.admin_name);
		parts.push(city.country);
		return parts.join(', ');
	}

	// Derived display value
	let displayValue = $derived(value ? formatCity(value) : searchQuery);

	// Debounced search function
	async function performSearch(query: string) {
		if (!query.trim()) {
			searchResults = [];
			showDropdown = false;
			return;
		}

		isSearching = true;

		try {
			const response = await cityListCities({
				query: {
					search: query,
					page_size: 10
				}
			});

			searchResults = response.data?.results || [];
			showDropdown = searchResults.length > 0;
			selectedIndex = -1;
		} catch (err) {
			console.error('City search error:', err);
			searchResults = [];
			showDropdown = false;
		} finally {
			isSearching = false;
		}
	}

	// Handle input change with debouncing
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;

		// Clear current selection when user types
		if (value) {
			onSelect(null);
		}

		// Clear existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Set new timer
		debounceTimer = setTimeout(() => {
			performSearch(searchQuery);
		}, 300);
	}

	// Handle city selection
	function selectCity(city: CitySchema) {
		onSelect(city);
		searchQuery = '';
		searchResults = [];
		showDropdown = false;
		selectedIndex = -1;
		inputElement?.blur();
	}

	// Clear selection
	function clearSelection() {
		onSelect(null);
		searchQuery = '';
		searchResults = [];
		showDropdown = false;
		selectedIndex = -1;
		inputElement?.focus();
	}

	// Handle keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		if (!showDropdown || searchResults.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;
			case 'Enter':
				e.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
					selectCity(searchResults[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				searchResults = [];
				showDropdown = false;
				selectedIndex = -1;
				inputElement?.blur();
				break;
		}
	}

	// Handle blur (close dropdown)
	function handleBlur() {
		// Delay to allow click events on dropdown items to fire
		setTimeout(() => {
			showDropdown = false;
			selectedIndex = -1;
		}, 200);
	}

	// Handle focus (reopen dropdown if there are results)
	function handleFocus() {
		if (searchResults.length > 0 && !value) {
			showDropdown = true;
		}
	}

	// Handle keyboard selection in list
	function handleListItemKeydown(e: KeyboardEvent, city: CitySchema) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			selectCity(city);
		}
	}
</script>

<div class="relative w-full">
	<label for="city-search" class="mb-2 block text-sm font-medium">{label}</label>

	<div class="relative">
		{#if value}
			<!-- Display selected city -->
			<div
				class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors {disabled
					? 'cursor-not-allowed opacity-50'
					: ''} {error ? 'border-destructive' : ''}"
			>
				<div class="flex items-center gap-2">
					<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<span>{formatCity(value)}</span>
				</div>
				{#if !disabled}
					<button
						type="button"
						onclick={clearSelection}
						class="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label="Clear city selection"
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>
		{:else}
			<!-- Search input -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					bind:this={inputElement}
					id="city-search"
					type="text"
					value={displayValue}
					oninput={handleInput}
					onkeydown={handleKeydown}
					onfocus={handleFocus}
					onblur={handleBlur}
					{disabled}
					placeholder="Search for a city..."
					aria-invalid={!!error}
					aria-describedby={error ? 'city-error' : undefined}
					aria-autocomplete="list"
					aria-controls="city-results"
					class="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {error
						? 'border-destructive'
						: ''}"
				/>
				{#if isSearching}
					<Loader2
						class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
						aria-hidden="true"
					/>
				{/if}
			</div>

			<!-- Dropdown results -->
			{#if showDropdown && searchResults.length > 0}
				<div
					id="city-results"
					role="listbox"
					class="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg"
				>
					<ul class="max-h-60 overflow-y-auto py-1">
						{#each searchResults as city, index (city.id)}
							<li
								role="option"
								aria-selected={index === selectedIndex}
								tabindex="0"
								class="cursor-pointer px-3 py-2 text-sm transition-colors {index === selectedIndex
									? 'bg-accent text-accent-foreground'
									: 'hover:bg-accent/50'}"
								onclick={() => selectCity(city)}
								onkeydown={(e) => handleListItemKeydown(e, city)}
							>
								<div class="flex items-center gap-2">
									<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
									<span>{formatCity(city)}</span>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>

	{#if error}
		<p id="city-error" class="mt-2 text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}

	{#if description}
		<p class="mt-2 text-xs text-muted-foreground">
			{description}
		</p>
	{/if}
</div>
