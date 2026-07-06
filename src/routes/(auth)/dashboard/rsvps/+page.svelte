<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { dashboardDashboardRsvps } from '$lib/api/generated/sdk.gen';
	import type { RsvpStatus } from '$lib/api/generated/types.gen';
	import RSVPCard from '$lib/components/rsvps/RSVPCard.svelte';
	import { CheckCircle2, Filter, ChevronLeft, ChevronRight, Loader2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const accessToken = $derived(authStore.accessToken);

	// Get current page from URL params
	const currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));

	// Canonical status order — keeps the URL (?status=yes,maybe) and the query key
	// stable regardless of the order chips were toggled in.
	const STATUS_ORDER: RsvpStatus[] = ['yes', 'maybe', 'no'];

	const statusToggles: Array<{ label: string; value: RsvpStatus }> = [
		{ label: m['dashboard.rsvps.status_going'](), value: 'yes' },
		{ label: m['dashboard.rsvps.status_maybe'](), value: 'maybe' },
		{ label: m['dashboard.rsvps.status_notGoing'](), value: 'no' }
	];

	// Status is URL-driven (?status=yes,maybe) so the filter is linkable and
	// restorable — e.g. the dashboard "Upcoming RSVPs" card links straight to
	// the Going + Maybe scope it counts. An empty selection means "all".
	function parseStatuses(param: string | null): RsvpStatus[] {
		if (!param) return [];
		const tokens = new Set(param.split(','));
		return STATUS_ORDER.filter((status) => tokens.has(status));
	}

	const selectedStatuses = $derived(parseStatuses(page.url.searchParams.get('status')));

	// Active filters
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
		queryKey: [
			'dashboard-rsvps',
			selectedStatuses,
			debouncedSearch,
			includePast,
			currentPage
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardRsvps({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					status: selectedStatuses.length ? selectedStatuses : undefined,
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

	const rsvps = $derived(rsvpsQuery.data?.results || []);
	const totalCount = $derived(rsvpsQuery.data?.count || 0);
	const totalPages = $derived(Math.ceil(totalCount / 12));
	const hasNextPage = $derived(currentPage < totalPages);
	const hasPrevPage = $derived(currentPage > 1);

	// Write the selected statuses to the URL (canonical order) and reset to the
	// first page. An empty selection drops the param entirely ("all").
	function setStatuses(statuses: RsvpStatus[]) {
		const url = new URL(page.url);
		const ordered = STATUS_ORDER.filter((status) => statuses.includes(status));
		if (ordered.length) {
			url.searchParams.set('status', ordered.join(','));
		} else {
			url.searchParams.delete('status');
		}
		url.searchParams.delete('page'); // Reset to first page when filter changes
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Toggle a single status in/out of the current selection.
	function toggleStatus(status: RsvpStatus) {
		setStatuses(
			selectedStatuses.includes(status)
				? selectedStatuses.filter((s) => s !== status)
				: [...selectedStatuses, status]
		);
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
				<button
					type="button"
					aria-pressed={selectedStatuses.length === 0}
					onclick={() => setStatuses([])}
					class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {selectedStatuses.length ===
					0
						? 'bg-primary text-primary-foreground hover:bg-primary/90'
						: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['dashboard.rsvps.status_all']()}
				</button>
				{#each statusToggles as toggle (toggle.value)}
					{@const active = selectedStatuses.includes(toggle.value)}
					<button
						type="button"
						aria-pressed={active}
						onclick={() => toggleStatus(toggle.value)}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {active
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						{toggle.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Include Past Events Checkbox -->
		<div>
			<div class="mb-2">
				<span class="text-sm font-medium">{m['dashboardRsvpsPage.options']()}</span>
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
			<span class="sr-only">{m['dashboardRsvpsPage.loading']()}</span>
		</div>
	{:else if rsvps.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-12 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
			>
				<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
			</div>
			<h2 class="mb-2 text-xl font-semibold">{m['dashboardRsvpsPage.noResults']()}</h2>
			{#if selectedStatuses.length || debouncedSearch}
				<p class="mb-4 text-muted-foreground">
					{m['dashboardRsvpsPage.noResultsFiltered']()}
				</p>
				<button
					type="button"
					onclick={() => {
						searchQuery = '';
						setStatuses([]);
					}}
					class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['dashboardRsvpsPage.clearFilters']()}
				</button>
			{:else}
				<p class="mb-4 text-muted-foreground">
					{m['dashboardRsvpsPage.emptyHint']()}
				</p>
				<a
					href="/events"
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['dashboardRsvpsPage.browseEvents']()}
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
