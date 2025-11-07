<script lang="ts">
	import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
	import { Building2, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { organizationListOrganizations } from '$lib/api';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		selectedOrganization?: { id: string; name: string; slug: string } | null;
		onChangeOrganization: (org: { id: string; name: string; slug: string } | null) => void;
		class?: string;
	}

	let { selectedOrganization = null, onChangeOrganization, class: className }: Props = $props();

	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<OrganizationRetrieveSchema[]>([]);
	let isDropdownOpen = $state(false);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Search organizations when query changes
	async function searchOrganizations(query: string): Promise<void> {
		if (query.length < 2) {
			searchResults = [];
			isDropdownOpen = false;
			return;
		}

		isSearching = true;

		try {
			const response = await organizationListOrganizations({
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
			console.error('Failed to search organizations:', error);
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
			searchOrganizations(searchQuery);
		}, 300);
	}

	function handleSelectOrganization(org: OrganizationRetrieveSchema): void {
		onChangeOrganization({ id: org.id, name: org.name, slug: org.slug });
		searchQuery = '';
		searchResults = [];
		isDropdownOpen = false;
	}

	function handleClearOrganization(): void {
		onChangeOrganization(null);
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
		<Building2 class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">{m['filters.organization.heading']()}</h3>
	</div>

	{#if selectedOrganization}
		<!-- Selected Organization Display -->
		<div
			class="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
		>
			<div class="flex-1">
				<div class="text-sm font-medium">{selectedOrganization.name}</div>
				<div class="text-xs text-muted-foreground">@{selectedOrganization.slug}</div>
			</div>
			<button
				type="button"
				onclick={handleClearOrganization}
				class="rounded-sm p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label={m['filters.organization.clear']()}
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	{:else}
		<!-- Organization Search Input -->
		<div class="relative">
			<div class="relative">
				<Building2
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					type="text"
					value={searchQuery}
					oninput={handleInput}
					onblur={handleBlur}
					onfocus={() => searchQuery.length >= 2 && searchOrganizations(searchQuery)}
					placeholder={m['filters.organization.placeholder']()}
					class="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label={m['filters.organization.label']()}
					autocomplete="off"
				/>
			</div>

			<!-- Search Results Dropdown -->
			{#if isDropdownOpen && searchResults.length > 0}
				<div
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover shadow-md"
				>
					{#each searchResults as org (org.id)}
						<button
							type="button"
							onclick={() => handleSelectOrganization(org)}
							class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
						>
							<Building2 class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<div class="flex-1">
								<div class="font-medium">{org.name}</div>
								<div class="text-xs text-muted-foreground">@{org.slug}</div>
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

		<p class="text-xs text-muted-foreground">{m['filters.organization.description']()}</p>
	{/if}
</div>
