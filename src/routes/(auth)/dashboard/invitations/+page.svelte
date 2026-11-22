<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { brandName } from '$lib/seo/tenant';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		dashboardDashboardInvitations,
		dashboardDashboardInvitationRequests
	} from '$lib/api/generated/sdk.gen';
	import InvitationCard from '$lib/components/invitations/InvitationCard.svelte';
	import InvitationRequestCard from '$lib/components/invitations/InvitationRequestCard.svelte';
	import DashboardBandLayout from '$lib/components/dashboard/DashboardBandLayout.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import DashboardFilterBar, {
		type FilterChipGroup
	} from '$lib/components/dashboard/DashboardFilterBar.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { createConfirm } from '$lib/components/common/confirm.svelte';
	import { Mail, Send, Loader2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { tenantOrgFilter } from '$lib/utils/tenant-filter';
	import { goto } from '$app/navigation';

	const accessToken = $derived(authStore.accessToken);

	// One confirm dialog for every request card.
	const confirmation = createConfirm();

	// Tab state
	type TabType = 'invitations' | 'requests';
	let activeTab = $state<TabType>('invitations');

	// Get current page from URL params
	const currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));

	// Invitations filters
	let invitationsSearch = $state('');
	let includePastInvitations = $state(false);
	let showAcceptedInvitations = $state(false);

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

	// On a tenant host every "my" call is scoped to the tenant org (#1056).
	const orgFilter = $derived(tenantOrgFilter(page.data));

	// Fetch invitations
	// NOTE: Include !!accessToken in queryKey to ensure TanStack Query refetches when auth state changes
	// This fixes a bug where navigating to this page client-side would show empty data
	const invitationsQuery = createQuery(() => ({
		queryKey: [
			'dashboard-invitations',
			!!accessToken,
			invitationsDebounced,
			includePastInvitations,
			showAcceptedInvitations,
			currentPage,
			orgFilter
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardInvitations({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					...orgFilter,
					search: invitationsDebounced || undefined,
					include_past: includePastInvitations,
					exclude_accepted: !showAcceptedInvitations,
					page: currentPage,
					page_size: 12
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken && activeTab === 'invitations'
	}));

	// Fetch invitation requests
	// NOTE: Include !!accessToken in queryKey to ensure TanStack Query refetches when auth state changes
	const requestsQuery = createQuery(() => ({
		queryKey: [
			'dashboard-invitation-requests',
			!!accessToken,
			requestsDebounced,
			requestsStatus,
			currentPage,
			orgFilter
		] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await dashboardDashboardInvitationRequests({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					...orgFilter,
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

	const invitations = $derived(invitationsQuery.data?.results || []);
	const invitationsCount = $derived(invitationsQuery.data?.count || 0);

	const requests = $derived(requestsQuery.data?.results || []);
	const requestsCount = $derived(requestsQuery.data?.count || 0);

	// Navigate to page
	function navigateToPage(pageNum: number) {
		const url = new URL(page.url);
		if (pageNum === 1) {
			url.searchParams.delete('page');
		} else {
			url.searchParams.set('page', pageNum.toString());
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- target is derived from the live page URL (base path already applied); resolve() cannot express search params
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Switch tab
	function switchTab(tab: TabType) {
		activeTab = tab;
		navigateToPage(1); // Reset to first page when switching tabs
	}

	function clearFilters() {
		if (activeTab === 'invitations') {
			invitationsSearch = '';
		} else {
			requestsSearch = '';
			requestsStatus = 'pending';
		}
		navigateToPage(1);
	}

	type RequestStatus = 'pending' | 'approved' | 'rejected' | null;

	function setRequestsStatus(status: RequestStatus) {
		requestsStatus = status;
		navigateToPage(1);
	}

	const requestsChipGroups = $derived<FilterChipGroup[]>([
		{
			id: 'status',
			label: m['dashboard.tickets.status'](),
			chips: [
				{ label: m['dashboard.invitations.status_pending'](), value: 'pending' as const },
				{ label: m['dashboard.invitations.status_approved'](), value: 'approved' as const },
				{ label: m['dashboard.invitations.status_rejected'](), value: 'rejected' as const },
				{ label: m['dashboard.tickets.status_all'](), value: null }
			].map((chip) => ({
				label: chip.label,
				active: requestsStatus === chip.value,
				onSelect: () => setRequestsStatus(chip.value)
			}))
		}
	]);
</script>

<svelte:head>
	<title>{m['dashboard.invitations.title']()} - {brandName(page.data.tenant)}</title>
	<meta name="description" content={m['dashboard.invitations.description']()} />
</svelte:head>

<!-- Celebration band + floating tab card (uplift); see DashboardBandLayout for
     the band's contrast contract. The tab strip is what meets the band's
     bottom edge, so it gets a card surface of its own — a bare underline rule
     landing on the cut reads as debris. Tab semantics (aria-current, the
     switchTab handler, the URL params) are untouched. -->
{#snippet tabsHeader()}
	<nav class="-mb-px flex gap-6" aria-label={m['dashboard.invitations.tabs']()}>
		<button
			type="button"
			onclick={() => switchTab('invitations')}
			class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
			'invitations'
				? 'border-primary font-bold text-primary'
				: 'border-transparent font-semibold text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
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
			class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
			'requests'
				? 'border-primary font-bold text-primary'
				: 'border-transparent font-semibold text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
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
{/snippet}

{#snippet invitationOptions()}
	<label class="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-0">
		<input
			type="checkbox"
			bind:checked={includePastInvitations}
			onchange={() => navigateToPage(1)}
			class="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		<span class="text-sm">{m['dashboard.tickets.includePast']()}</span>
	</label>
	<label class="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-0">
		<input
			type="checkbox"
			bind:checked={showAcceptedInvitations}
			onchange={() => navigateToPage(1)}
			class="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		<span class="text-sm">{m['dashboard.invitations.showAccepted']()}</span>
	</label>
{/snippet}

<DashboardBandLayout
	title={m['dashboard.invitations.title']()}
	subtitle={m['dashboard.invitations.description']()}
	kicker={m['userMenu.dashboard']()}
>
	<DashboardFilterBar
		header={tabsHeader}
		searchValue={activeTab === 'invitations' ? invitationsSearch : requestsSearch}
		onSearch={(value) => {
			if (activeTab === 'invitations') invitationsSearch = value;
			else requestsSearch = value;
		}}
		searchLabel={m['dashboard.invitations.searchPlaceholder']()}
		searchPlaceholder={m['dashboard.invitations.searchPlaceholder']()}
		chipGroups={activeTab === 'requests' ? requestsChipGroups : []}
		options={activeTab === 'invitations' ? invitationOptions : undefined}
		optionsLabel={m['dashboardTicketsPage.options']()}
		hasActiveFilters={activeTab === 'invitations'
			? !!invitationsDebounced
			: !!requestsDebounced || requestsStatus !== 'pending'}
		onClear={clearFilters}
		clearLabel={m['dashboard.invitations.clearFilters']()}
	/>

	<!-- Tab Content -->
	{#if activeTab === 'invitations'}
		<!-- Invitations Tab -->
		<div class="space-y-6">
			<!-- Invitations List -->
			{#if invitationsQuery.isPending}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">{m['dashboard.invitations.loadingInvitations']()}</span>
				</div>
			{:else if invitations.length === 0}
				<EmptyState
					icon={Mail}
					title={m['dashboard.invitations.noInvitations']()}
					body={invitationsDebounced
						? m['dashboard.invitations.tryAdjustingSearch']()
						: m['dashboard.invitations.noReceivedInvitations']()}
					level={2}
				/>
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
			<!-- Requests List -->
			{#if requestsQuery.isPending}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
					<span class="sr-only">{m['dashboard.invitations.loadingRequests']()}</span>
				</div>
			{:else if requests.length === 0}
				<EmptyState
					icon={Send}
					title={m['dashboard.invitations.noRequests']()}
					body={requestsDebounced || requestsStatus !== 'pending'
						? m['dashboard.invitations.tryAdjustingFilters']()
						: m['dashboard.invitations.noSentInvitations']()}
					level={2}
				/>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each requests as request (request.id)}
						<InvitationRequestCard
							{request}
							confirmCancel={() =>
								confirmation.ask({
									message: m['invitationRequestCard.cancelConfirm'](),
									destructive: true
								})}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</DashboardBandLayout>

<ConfirmDialog {...confirmation.dialogProps} />
