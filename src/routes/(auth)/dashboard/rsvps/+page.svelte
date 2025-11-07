<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { dashboardDashboardRsvps } from '$lib/api/generated/sdk.gen';
	import type { Status } from '$lib/api/generated/types.gen';
	import RSVPCard from '$lib/components/rsvps/RSVPCard.svelte';
	import {
		CheckCircle2,
		XCircle,
		HelpCircle,
		Filter,
		ChevronLeft,
		ChevronRight,
		Loader2
	} from 'lucide-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let accessToken = $derived(authStore.accessToken);

	// Get current page from URL params
	let currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));

	const statusFilters: Array<{ label: string; value: Status | null }> = [
		{ label: m['dashboard.rsvps.status_all'](), value: null },
		{ label: m['dashboard.rsvps.status_going'](), value: 'yes' },
		{ label: m['dashboard.rsvps.status_maybe'](), value: 'maybe' },
		{ label: m['dashboard.rsvps.status_notGoing'](), value: 'no' }
	];

	// Active filters
	let statusFilter = $state<Status | null>(null);
	let searchQuery = $state('');
	let includePast = $state(false);

	// Debounce search input
	let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let debouncedSearch = $state('');

	// Update debounced search after delay
	$effect(() => {
		if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
		searchDebounceTimeout = setTimeout(() => {
			debouncedSearch = searchQuery;
		}, 300);
	});

	// Fetch RSVPs with filters
	const rsvpsQuery = createQuery(() => ({
		queryKey: ['dashboard-rsvps', statusFilter, debouncedSearch, includePast, currentPage] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardRsvps({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					status: statusFilter as any,
					search: debouncedSearch || undefined,
					include_past: includePast,
					page: currentPage,
					page_size: 12
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken
	}));

	let rsvps = $derived(rsvpsQuery.data?.results || []);
	let totalCount = $derived(rsvpsQuery.data?.count || 0);
	let totalPages = $derived(Math.ceil(totalCount / 12));
	let hasNextPage = $derived(currentPage < totalPages);
	let hasPrevPage = $derived(currentPage > 1);

	// Apply filter
	function applyStatusFilter(status: Status | null) {
		statusFilter = status;
		navigateToPage(1); // Reset to first page when filter changes
	}

	// Navigate to page
	function navigateToPage(pageNum: number) {
		const url = new URL(page.url);
		if (pageNum === 1) {
			url.searchParams.delete('page');
		} else {
			url.searchParams.set('page', pageNum.toString());
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Check if filter is active
	function isStatusFilterActive(status: Status | null): boolean {
		return statusFilter === status;
	}
</script>

<svelte:head>
	{m['dashboard.rsvps.title']()} - Revel
	<meta name="description" content={m['dashboard.rsvps.description']()} />
</svelte:head>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<CheckCircle2 class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div>
				<h1 class="text-2xl font-bold md:text-3xl">{m['dashboard.rsvps.title']()}</h1>
				<p class="text-muted-foreground">{m['dashboard.rsvps.description']()}</p>
			</div>
		</div>

		<!-- RSVP Count -->
		{#if !rsvpsQuery.isLoading && totalCount > 0}
			<p class="mt-4 text-sm text-muted-foreground">
				{m['dashboard.rsvps.showing']({
					count: rsvps.length.toString(),
					total: totalCount.toString()
				})}
				{totalCount === 1 ? m['dashboard.rsvps.rsvp']() : m['dashboard.rsvps.rsvps']()}
			</p>
		{/if}
	</div>

	<!-- Search Bar -->
	<div class="mb-6">
		<label for="search" class="sr-only">{m['dashboard.rsvps.searchPlaceholder']()}</label>
		<input
			id="search"
			type="search"
			bind:value={searchQuery}
			placeholder={m['dashboard.rsvps.searchPlaceholder']()}
			class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		/>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-4">
		<!-- Status Filter -->
		<div>
			<div class="mb-2 flex items-center gap-2">
				<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<span class="text-sm font-medium">{m['dashboard.rsvps.status']()}</span>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each statusFilters as filter}
					<button
						type="button"
						onclick={() => applyStatusFilter(filter.value)}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {isStatusFilterActive(
							filter.value
						)
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						{filter.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Include Past Events Checkbox -->
		<div>
			<div class="mb-2">
				<span class="text-sm font-medium">Options</span>
			</div>
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					bind:checked={includePast}
					onchange={() => navigateToPage(1)}
					class="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
				/>
				<span class="text-sm">{m['dashboard.rsvps.includePast']()}</span>
			</label>
		</div>
	</div>

	<!-- RSVPs List -->
	{#if rsvpsQuery.isLoading}
		<!-- Loading State -->
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
			<span class="sr-only">Loading RSVPs...</span>
		</div>
	{:else if rsvps.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-12 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
			>
				<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
			</div>
			<h2 class="mb-2 text-xl font-semibold">No RSVPs found</h2>
			{#if statusFilter || debouncedSearch}
				<p class="mb-4 text-muted-foreground">
					Try adjusting your filters or search query to see more RSVPs
				</p>
				<button
					type="button"
					onclick={() => {
						statusFilter = null;
						searchQuery = '';
						navigateToPage(1);
					}}
					class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Clear Filters
				</button>
			{:else}
				<p class="mb-4 text-muted-foreground">
					You haven't RSVP'd to any events yet. Browse events to find something interesting!
				</p>
				<a
					href="/events"
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Browse Events
				</a>
			{/if}
		</div>
	{:else}
		<!-- RSVPs Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each rsvps as rsvp (rsvp.id)}
				<RSVPCard {rsvp} />
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-8 flex items-center justify-between border-t border-border pt-6">
				<div class="text-sm text-muted-foreground">
					Page {currentPage} of {totalPages}
				</div>

				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => navigateToPage(currentPage - 1)}
						disabled={!hasPrevPage}
						class="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['dashboard.rsvps.previousPage']()}
					>
						<ChevronLeft class="h-4 w-4" aria-hidden="true" />
						{m['dashboard.rsvps.previousPage']()}
					</button>

					<button
						type="button"
						onclick={() => navigateToPage(currentPage + 1)}
						disabled={!hasNextPage}
						class="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['dashboard.rsvps.nextPage']()}
					>
						{m['dashboard.rsvps.nextPage']()}
						<ChevronRight class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
