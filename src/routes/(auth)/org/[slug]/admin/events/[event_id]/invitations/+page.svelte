<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { goto } from '$app/navigation';
	import { Check, AlertCircle, ChevronLeft, Mail, UserPlus, Link } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import InvitationRequestsTab from '$lib/components/invitations/InvitationRequestsTab.svelte';
	import InvitationListTab from '$lib/components/invitations/InvitationListTab.svelte';
	import InvitationLinksTab from '$lib/components/invitations/InvitationLinksTab.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Active tab state
	let activeTab = $state<'requests' | 'invitations' | 'links'>(data.activeTab as any);

	// Filter states
	let activeStatusFilter = $state<string | null>(data.filters?.status || null);
	let searchQuery = $state(data.filters?.search || '');
	let searchInput = $state(searchQuery);

	function switchTab(tab: 'requests' | 'invitations' | 'links') {
		activeTab = tab;
		const params = new URLSearchParams(window.location.search);
		params.set('tab', tab);
		params.delete('page');
		params.delete('status');
		params.delete('search');
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	function applyFilters() {
		const params = new URLSearchParams();
		params.set('tab', activeTab);
		if (activeStatusFilter) params.set('status', activeStatusFilter);
		if (searchQuery) params.set('search', searchQuery);
		window.location.href = `?${params.toString()}`;
	}

	function filterByStatus(status: string | null) {
		activeStatusFilter = status;
		applyFilters();
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchInput = target.value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchQuery = searchInput;
			applyFilters();
		}, 500);
	}
</script>

<svelte:head>
	<title>Manage Invitations - {data.event.name} | {data.organization.name} Admin | Revel</title>
	<meta name="description" content="Manage invitations for {data.event.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<div class="mb-4">
			<a
				href="/org/{data.organization.slug}/admin/events"
				class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				{m['eventInvitationsAdmin.backToEvents']()}
			</a>
		</div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
			{m['eventInvitationsAdmin.pageTitle']()}
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">{data.event.name}</p>
	</div>

	<!-- Success/Error Messages -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">
				{#if form.action === 'approved'}
					{m['eventInvitationsAdmin.requestApproved']()}
				{:else if form.action === 'rejected'}
					{m['eventInvitationsAdmin.requestRejected']()}
				{:else if form.action === 'created'}
					{m['eventInvitationsAdmin.invitationsCreated']({
						created: form.data?.created_invitations || 0,
						pending: form.data?.pending_invitations || 0
					})}
				{:else if form.action === 'deleted'}
					{m['eventInvitationsAdmin.invitationDeleted']()}
				{:else if form.action === 'updated'}
					{m['eventInvitationsAdmin.invitationUpdated']()}
				{:else if form.action === 'bulk_updated'}
					{m['eventInvitationsAdmin.bulkUpdated']({ count: form.count || 0 })}
				{/if}
			</p>
		</div>
	{/if}

	{#if form?.errors?.form}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="border-b border-border">
		<nav class="-mb-px flex flex-wrap gap-x-4 sm:gap-x-6" aria-label="Tabs">
			<button
				type="button"
				onclick={() => switchTab('requests')}
				class={cn(
					'border-b-2 px-1 py-3 text-sm font-medium transition-colors',
					activeTab === 'requests'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
				)}
			>
				<div class="flex items-center gap-1.5 sm:gap-2">
					<Mail class="h-4 w-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m['eventInvitationsAdmin.tabRequests']()}</span>
					<span class="sm:hidden">{m['eventInvitationsAdmin.tabRequestsShort']()}</span>
					<span
						class="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground sm:px-2"
					>
						{data.requestsPagination.totalCount}
					</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => switchTab('invitations')}
				class={cn(
					'border-b-2 px-1 py-3 text-sm font-medium transition-colors',
					activeTab === 'invitations'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
				)}
			>
				<div class="flex items-center gap-1.5 sm:gap-2">
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m['eventInvitationsAdmin.tabInvitations']()}</span>
					<span class="sm:hidden">{m['eventInvitationsAdmin.tabInvitationsShort']()}</span>
					<span
						class="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground sm:px-2"
					>
						{data.registeredPagination.totalCount + data.pendingPagination.totalCount}
					</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => switchTab('links')}
				class={cn(
					'border-b-2 px-1 py-3 text-sm font-medium transition-colors',
					activeTab === 'links'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
				)}
			>
				<div class="flex items-center gap-1.5 sm:gap-2">
					<Link class="h-4 w-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m['eventInvitationsAdmin.tabLinks']()}</span>
					<span class="sm:hidden">{m['eventInvitationsAdmin.tabLinksShort']()}</span>
				</div>
			</button>
		</nav>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'requests'}
		<InvitationRequestsTab
			invitationRequests={data.invitationRequests}
			requestsPagination={data.requestsPagination}
			{activeStatusFilter}
			{searchQuery}
			onFilterByStatus={filterByStatus}
			onSearchInput={handleSearchInput}
			{searchInput}
		/>
	{:else if activeTab === 'invitations'}
		<InvitationListTab
			registeredInvitations={data.registeredInvitations}
			pendingInvitations={data.pendingInvitations}
			registeredPagination={data.registeredPagination}
			pendingPagination={data.pendingPagination}
			organizationSlug={data.organization.slug}
			ticketTiers={data.ticketTiers}
			{accessToken}
			{searchInput}
			onSearchInput={handleSearchInput}
		/>
	{:else if activeTab === 'links'}
		<InvitationLinksTab
			eventId={data.event.id}
			orgSlug={data.event.organization.slug}
			eventSlug={data.event.slug}
		/>
	{/if}
</div>
