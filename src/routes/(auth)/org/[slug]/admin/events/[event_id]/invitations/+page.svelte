<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Check, AlertCircle, ChevronLeft, Mail, UserPlus, Link } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import InvitationRequestsTab from '$lib/components/invitations/InvitationRequestsTab.svelte';
	import InvitationListTab from '$lib/components/invitations/InvitationListTab.svelte';
	import InvitationLinksTab from '$lib/components/invitations/InvitationLinksTab.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Active tab state. `data.activeTab` comes from the URL, so narrow it
	// against the known tabs (falling back to the default tab).
	const TABS = ['requests', 'invitations', 'links'] as const;
	let activeTab = $state<'requests' | 'invitations' | 'links'>(
		TABS.find((t) => t === data.activeTab) ?? 'requests'
	);

	// Filter states
	let activeStatusFilter = $state<string | null>(data.filters?.status || null);
	let searchQuery = $state(data.filters?.search || '');
	let searchInput = $state(searchQuery);

	function switchTab(tab: 'requests' | 'invitations' | 'links') {
		activeTab = tab;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams(window.location.search);
		params.set('tab', tab);
		params.delete('page');
		params.delete('status');
		params.delete('search');
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	function applyFilters() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via window.location.href
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
	<title
		>{m['eventInvitationsAdmin.headTitle']({ eventName: data.event.name })} | {data.organization
			.name} Admin | Revel</title
	>
	<meta
		name="description"
		content={m['eventInvitationsAdmin.headDescription']({ eventName: data.event.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<a
			href={resolve('/(auth)/org/[slug]/admin/events', { slug: data.organization.slug })}
			class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronLeft class="h-4 w-4" aria-hidden="true" />
			{m['eventInvitationsAdmin.backToEvents']()}
		</a>
		<PageHeader title={m['eventInvitationsAdmin.pageTitle']()} subtitle={data.event.name} />
	</div>

	<!-- Success/Error Messages. Both tints composite against whatever sits
	     behind them, so each gets an opaque `bg-card` layer underneath:
	     `text-success` on a bare `bg-success/10` measures 4.39:1 over the page
	     background (below 4.5 for this normal-size text) — the card backing
	     brings it to 4.94:1 (hand-verified). The error banner's heading/body
	     stay on `text-foreground` (always-audited body-text pair) with the
	     icon alone carrying the destructive tone — the danger-framing rule,
	     not a contrast workaround: since #781 `text-destructive` resolves to
	     --destructive-text and measures at worst 7.20:1 light / 6.05:1 dark on
	     this tint, over either container (both are COMPOSITED_PAIRS rows now).
	     It was 2.95:1 in dark before the split, which is why this note used to
	     read as an apology. -->
	{#if form?.success}
		<div class="relative overflow-hidden rounded-lg border border-success/40 bg-card" role="alert">
			<div class="absolute inset-0 bg-success/10" aria-hidden="true"></div>
			<div class="relative flex items-center gap-2 p-4">
				<Check class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
				<p class="text-sm font-medium text-success">
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
		</div>
	{/if}

	{#if form?.errors?.form}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-foreground"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="border-b border-border">
		<nav
			class="-mb-px flex flex-wrap gap-x-4 sm:gap-x-6"
			aria-label={m['eventInvitationsAdmin.tabsAriaLabel']()}
		>
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
			eventStart={data.event.start}
		/>
	{/if}
</div>
