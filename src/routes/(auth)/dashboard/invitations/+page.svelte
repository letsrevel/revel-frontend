<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		dashboardDashboardInvitations,
		dashboardDashboardInvitationRequests
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
			'dashboard-invitations',
			invitationsDebounced,
			includePastInvitations,
			currentPage
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardInvitations({
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
		queryKey: [
			'dashboard-invitation-requests',
			requestsDebounced,
			requestsStatus,
			currentPage
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardInvitationRequests({
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
	<title>{m['dashboard.invitations.title']()} - Revel</title>
	<meta name="description" content={m['dashboard.invitations.description']()} />
</svelte:head>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<Mail class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div>
				<h1 class="text-2xl font-bold md:text-3xl">{m['dashboard.invitations.title']()}</h1>
				<p class="text-muted-foreground">{m['dashboard.invitations.description']()}</p>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-6">
		<div class="border-b border-border">
			<nav class="-mb-px flex gap-6" aria-label={m['dashboard.invitations.tabs']()}>
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
					{m['dashboard.invitations.received']()}
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
					{m['dashboard.invitations.sent']()}
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
				<label for="invitations-search" class="sr-only">{m['dashboard.invitations.searchPlaceholder']()}</label>
				<input
					id="invitations-search"
					type="search"
					bind:value={invitationsSearch}
					placeholder={m['dashboard.invitations.searchPlaceholder']()}
					class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<!-- Filters -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<span class="text-sm font-medium">{m['dashboard.tickets.status']()}</span>
				</div>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={includePastInvitations}
						onchange={() => navigateToPage(1)}
						class="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<span class="text-sm">{m['dashboard.tickets.includePast']()}</span>
				</label>
			</div>

			<!-- Invitations List -->
			{#if invitationsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">{m['dashboard.invitations.loadingInvitations']()}</span>
				</div>
			{:else if invitations.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Mail class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h2 class="mb-2 text-xl font-semibold">{m['dashboard.invitations.noInvitations']()}</h2>
					{#if invitationsDebounced}
						<p class="mb-4 text-muted-foreground">
							{m['dashboard.invitations.tryAdjustingSearch']()}
						</p>
						<button
							type="button"
							onclick={() => {
								invitationsSearch = '';
								navigateToPage(1);
							}}
							class="rounded-lg border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{m['dashboard.invitations.clearSearch']()}
						</button>
					{:else}
						<p class="text-muted-foreground">
							{m['dashboard.invitations.noReceivedInvitations']()}
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
				<label for="requests-search" class="sr-only">{m['dashboard.invitations.searchPlaceholder']()}</label>
				<input
					id="requests-search"
					type="search"
					bind:value={requestsSearch}
					placeholder={m['dashboard.invitations.searchPlaceholder']()}
					class="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<!-- Status Filter -->
			<div>
				<div class="mb-2 flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<span class="text-sm font-medium">{m['dashboard.tickets.status']()}</span>
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
						{m['dashboard.invitations.status_pending']()}
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
						{m['dashboard.invitations.status_approved']()}
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
						{m['dashboard.invitations.status_rejected']()}
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
						{m['dashboard.tickets.status_all']()}
					</button>
				</div>
			</div>

			<!-- Requests List -->
			{#if requestsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">{m['dashboard.invitations.loadingRequests']()}</span>
				</div>
			{:else if requests.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Send class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h2 class="mb-2 text-xl font-semibold">{m['dashboard.invitations.noRequests']()}</h2>
					{#if requestsDebounced || requestsStatus}
						<p class="mb-4 text-muted-foreground">
							{m['dashboard.invitations.tryAdjustingFilters']()}
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
							{m['dashboard.invitations.clearFilters']()}
						</button>
					{:else}
						<p class="text-muted-foreground">
							{m['dashboard.invitations.noSentInvitations']()}
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
