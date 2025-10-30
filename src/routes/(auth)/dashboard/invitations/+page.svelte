<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventListMyInvitations,
		eventListMyInvitationRequests
	} from '$lib/api/generated/sdk.gen';
	import InvitationCard from '$lib/components/invitations/InvitationCard.svelte';
	import InvitationRequestCard from '$lib/components/invitations/InvitationRequestCard.svelte';
	import { Mail, Send, Loader2, Filter } from 'lucide-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let accessToken = $derived(authStore.accessToken);

	// Tab state
	type TabType = 'invitations' | 'requests';
	let activeTab = $state<TabType>('invitations');

	// Get current page from URL params
	let currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));

	// Invitations filters
	let invitationsSearch = $state('');
	let includePastInvitations = $state(false);

	// Invitation requests filters
	let requestsSearch = $state('');
	let requestsStatus = $state<'pending' | 'approved' | 'rejected' | null>('pending');

	// Debounce search
	let invitationsDebounced = $state('');
	let requestsDebounced = $state('');
	let invitationsTimeout: ReturnType<typeof setTimeout> | null = null;
	let requestsTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (invitationsTimeout) clearTimeout(invitationsTimeout);
		invitationsTimeout = setTimeout(() => {
			invitationsDebounced = invitationsSearch;
		}, 300);
	});

	$effect(() => {
		if (requestsTimeout) clearTimeout(requestsTimeout);
		requestsTimeout = setTimeout(() => {
			requestsDebounced = requestsSearch;
		}, 300);
	});

	// Fetch invitations
	const invitationsQuery = createQuery(() => ({
		queryKey: [
			'my-invitations',
			invitationsDebounced,
			includePastInvitations,
			currentPage
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await eventListMyInvitations({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					search: invitationsDebounced || undefined,
					include_past: includePastInvitations,
					page: currentPage,
					page_size: 12
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken && activeTab === 'invitations'
	}));

	// Fetch invitation requests
	const requestsQuery = createQuery(() => ({
		queryKey: ['my-invitation-requests', requestsDebounced, requestsStatus, currentPage] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await eventListMyInvitationRequests({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					search: requestsDebounced || undefined,
					status: requestsStatus || undefined,
					page: currentPage,
					page_size: 12
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken && activeTab === 'requests'
	}));

	let invitations = $derived(invitationsQuery.data?.results || []);
	let invitationsCount = $derived(invitationsQuery.data?.count || 0);

	let requests = $derived(requestsQuery.data?.results || []);
	let requestsCount = $derived(requestsQuery.data?.count || 0);

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

	// Switch tab
	function switchTab(tab: TabType) {
		activeTab = tab;
		navigateToPage(1); // Reset to first page when switching tabs
	}
</script>

<svelte:head>
	<title>My Invitations - Revel</title>
	<meta name="description" content="View your event invitations and invitation requests" />
</svelte:head>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<Mail class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div>
				<h1 class="text-2xl font-bold md:text-3xl">My Invitations</h1>
				<p class="text-muted-foreground">Manage your event invitations and access requests</p>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-6">
		<div class="border-b border-border">
			<nav class="-mb-px flex gap-6" aria-label="Invitation tabs">
				<button
					type="button"
					onclick={() => switchTab('invitations')}
					class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
					'invitations'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
					aria-current={activeTab === 'invitations' ? 'page' : undefined}
				>
					<Mail class="h-4 w-4" aria-hidden="true" />
					My Invitations
					{#if invitationsCount > 0}
						<span
							class="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
						>
							{invitationsCount}
						</span>
					{/if}
				</button>

				<button
					type="button"
					onclick={() => switchTab('requests')}
					class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
					'requests'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
					aria-current={activeTab === 'requests' ? 'page' : undefined}
				>
					<Send class="h-4 w-4" aria-hidden="true" />
					My Requests
					{#if requestsCount > 0}
						<span
							class="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
						>
							{requestsCount}
						</span>
					{/if}
				</button>
			</nav>
		</div>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'invitations'}
		<!-- Invitations Tab -->
		<div class="space-y-6">
			<!-- Search Bar -->
			<div>
				<label for="invitations-search" class="sr-only">Search invitations</label>
				<input
					id="invitations-search"
					type="search"
					bind:value={invitationsSearch}
					placeholder="Search by event name..."
					class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<!-- Filters -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<span class="text-sm font-medium">Options</span>
				</div>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={includePastInvitations}
						onchange={() => navigateToPage(1)}
						class="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<span class="text-sm">Include past events</span>
				</label>
			</div>

			<!-- Invitations List -->
			{#if invitationsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">Loading invitations...</span>
				</div>
			{:else if invitations.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Mail class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h2 class="mb-2 text-xl font-semibold">No invitations found</h2>
					{#if invitationsDebounced}
						<p class="mb-4 text-muted-foreground">
							Try adjusting your search to see more invitations
						</p>
						<button
							type="button"
							onclick={() => {
								invitationsSearch = '';
								navigateToPage(1);
							}}
							class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							Clear Search
						</button>
					{:else}
						<p class="text-muted-foreground">
							You haven't received any special event invitations yet
						</p>
					{/if}
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each invitations as invitation (invitation.id)}
						<InvitationCard {invitation} />
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Requests Tab -->
		<div class="space-y-6">
			<!-- Search Bar -->
			<div>
				<label for="requests-search" class="sr-only">Search requests</label>
				<input
					id="requests-search"
					type="search"
					bind:value={requestsSearch}
					placeholder="Search by event name..."
					class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<!-- Status Filter -->
			<div>
				<div class="mb-2 flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<span class="text-sm font-medium">Status</span>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => {
							requestsStatus = 'pending';
							navigateToPage(1);
						}}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {requestsStatus ===
						'pending'
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						Pending
					</button>
					<button
						type="button"
						onclick={() => {
							requestsStatus = 'approved';
							navigateToPage(1);
						}}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {requestsStatus ===
						'approved'
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						Approved
					</button>
					<button
						type="button"
						onclick={() => {
							requestsStatus = 'rejected';
							navigateToPage(1);
						}}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {requestsStatus ===
						'rejected'
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						Rejected
					</button>
					<button
						type="button"
						onclick={() => {
							requestsStatus = null;
							navigateToPage(1);
						}}
						class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {requestsStatus ===
						null
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						All
					</button>
				</div>
			</div>

			<!-- Requests List -->
			{#if requestsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">Loading requests...</span>
				</div>
			{:else if requests.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Send class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h2 class="mb-2 text-xl font-semibold">No requests found</h2>
					{#if requestsDebounced || requestsStatus}
						<p class="mb-4 text-muted-foreground">
							Try adjusting your filters to see more requests
						</p>
						<button
							type="button"
							onclick={() => {
								requestsSearch = '';
								requestsStatus = 'pending';
								navigateToPage(1);
							}}
							class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							Clear Filters
						</button>
					{:else}
						<p class="text-muted-foreground">
							You haven't requested access to any private events yet
						</p>
					{/if}
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each requests as request (request.id)}
						<InvitationRequestCard {request} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
