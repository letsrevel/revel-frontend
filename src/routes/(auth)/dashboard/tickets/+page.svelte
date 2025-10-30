<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventListUserTickets } from '$lib/api/generated/sdk.gen';
	import type { PaymentMethod, EventsModelsEventTicketStatus } from '$lib/api/generated/types.gen';
	import TicketListCard from '$lib/components/tickets/TicketListCard.svelte';
	import { Ticket, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let accessToken = $derived(authStore.accessToken);

	// Get current page from URL params
	let currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));

	// Use the generated type alias for ticket status
	type TicketStatus = EventsModelsEventTicketStatus;

	const statusFilters: Array<{ label: string; value: TicketStatus | null }> = [
		{ label: 'All', value: null },
		{ label: 'Active', value: 'active' },
		{ label: 'Pending', value: 'pending' },
		{ label: 'Checked In', value: 'checked_in' },
		{ label: 'Cancelled', value: 'cancelled' }
	];

	const paymentMethodFilters: Array<{ label: string; value: PaymentMethod | null }> = [
		{ label: 'All Payment Methods', value: null },
		{ label: 'Free', value: 'free' },
		{ label: 'Paid', value: 'online' },
		{ label: 'Offline', value: 'offline' },
		{ label: 'At the Door', value: 'at_the_door' }
	];

	// Active filters
	let statusFilter = $state<TicketStatus | null>(null);
	let paymentMethodFilter = $state<PaymentMethod | null>(null);
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

	// Fetch tickets with filters
	const ticketsQuery = createQuery(() => ({
		queryKey: [
			'my-tickets',
			statusFilter,
			paymentMethodFilter,
			debouncedSearch,
			includePast,
			currentPage
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await eventListUserTickets({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					status: statusFilter as any,
					tier__payment_method: paymentMethodFilter || undefined,
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

	let tickets = $derived(ticketsQuery.data?.results || []);
	let totalCount = $derived(ticketsQuery.data?.count || 0);
	let totalPages = $derived(Math.ceil(totalCount / 12));
	let hasNextPage = $derived(currentPage < totalPages);
	let hasPrevPage = $derived(currentPage > 1);

	// Apply filter
	function applyStatusFilter(status: TicketStatus | null) {
		statusFilter = status;
		navigateToPage(1); // Reset to first page when filter changes
	}

	function applyPaymentMethodFilter(method: PaymentMethod | null) {
		paymentMethodFilter = method;
		navigateToPage(1);
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
	function isStatusFilterActive(status: TicketStatus | null): boolean {
		return statusFilter === status;
	}

	function isPaymentMethodFilterActive(method: PaymentMethod | null): boolean {
		return paymentMethodFilter === method;
	}
</script>

<svelte:head>
	<title>My Tickets - Revel</title>
	<meta name="description" content="View and manage all your event tickets" />
</svelte:head>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<Ticket class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div>
				<h1 class="text-2xl font-bold md:text-3xl">My Tickets</h1>
				<p class="text-muted-foreground">View and manage all your event tickets</p>
			</div>
		</div>

		<!-- Ticket Count -->
		{#if !ticketsQuery.isLoading && totalCount > 0}
			<p class="mt-4 text-sm text-muted-foreground">
				Showing {tickets.length} of {totalCount}
				{totalCount === 1 ? 'ticket' : 'tickets'}
			</p>
		{/if}
	</div>

	<!-- Search Bar -->
	<div class="mb-6">
		<label for="search" class="sr-only">Search tickets</label>
		<input
			id="search"
			type="search"
			bind:value={searchQuery}
			placeholder="Search by event name or ticket tier..."
			class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		/>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-4">
		<!-- Status Filter -->
		<div>
			<div class="mb-2 flex items-center gap-2">
				<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<span class="text-sm font-medium">Status</span>
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

		<!-- Payment Method Filter -->
		<div>
			<div class="mb-2">
				<span class="text-sm font-medium">Payment Method</span>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each paymentMethodFilters as filter}
					<button
						type="button"
						onclick={() => applyPaymentMethodFilter(filter.value)}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {isPaymentMethodFilterActive(
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
				<span class="text-sm">Include past events</span>
			</label>
		</div>
	</div>

	<!-- Tickets List -->
	{#if ticketsQuery.isLoading}
		<!-- Loading State -->
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
			<span class="sr-only">Loading tickets...</span>
		</div>
	{:else if tickets.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-12 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
			>
				<Ticket class="h-8 w-8 text-primary" aria-hidden="true" />
			</div>
			<h2 class="mb-2 text-xl font-semibold">No tickets found</h2>
			{#if statusFilter || paymentMethodFilter || debouncedSearch}
				<p class="mb-4 text-muted-foreground">
					Try adjusting your filters or search query to see more tickets
				</p>
				<button
					type="button"
					onclick={() => {
						statusFilter = null;
						paymentMethodFilter = null;
						searchQuery = '';
						navigateToPage(1);
					}}
					class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Clear Filters
				</button>
			{:else}
				<p class="mb-4 text-muted-foreground">
					You don't have any tickets yet. Browse events to find something interesting!
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
		<!-- Tickets Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each tickets as ticket (ticket.id)}
				<TicketListCard {ticket} />
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
						aria-label="Previous page"
					>
						<ChevronLeft class="h-4 w-4" aria-hidden="true" />
						Previous
					</button>

					<button
						type="button"
						onclick={() => navigateToPage(currentPage + 1)}
						disabled={!hasNextPage}
						class="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Next page"
					>
						Next
						<ChevronRight class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
