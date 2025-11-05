<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventadminUpdateRsvp, eventadminDeleteRsvp } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cn } from '$lib/utils/cn';
	import { Search, Users, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import type { RsvpDetailSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// Filter state
	let searchQuery = $state(data.filters.search || '');
	let searchInput = $state(searchQuery); // For debouncing
	let activeStatusFilter = $state<string | null>(data.filters.status || null);

	// Modal states
	let editingRsvp = $state<RsvpDetailSchema | null>(null);
	let showEditModal = $state(false);
	let selectedStatus = $state<'yes' | 'maybe' | 'no'>('yes');

	// Delete confirmation state
	let deletingRsvp = $state<RsvpDetailSchema | null>(null);
	let showDeleteDialog = $state(false);

	// Computed: Has multiple pages
	let hasMultiplePages = $derived(!!data.nextPage || !!data.previousPage);

	// Computed: Stats (always shown)
	let stats = $derived.by(() => {
		const yesCount = data.rsvps.filter((r) => r.status === 'yes').length;
		const maybeCount = data.rsvps.filter((r) => r.status === 'maybe').length;
		const noCount = data.rsvps.filter((r) => r.status === 'no').length;

		return { yesCount, maybeCount, noCount, total: data.totalCount };
	});

	// Update RSVP mutation
	const updateRsvpMutation = createMutation(() => ({
		mutationFn: async ({ rsvpId, status }: { rsvpId: string; status: 'yes' | 'maybe' | 'no' }) => {
			const response = await eventadminUpdateRsvp({
				path: { event_id: data.event.id, rsvp_id: rsvpId },
				body: { status: status as any }, // Type assertion due to OpenAPI schema issue
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(m['attendeesAdmin.error_failedToUpdate']());
			}

			return response.data;
		},
		onSuccess: () => {
			// Close modal
			showEditModal = false;
			editingRsvp = null;

			// Reload page to refresh data
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(`${m['attendeesAdmin.error_failedToUpdate']()}: ${error.message}`);
		}
	}));

	// Delete RSVP mutation
	const deleteRsvpMutation = createMutation(() => ({
		mutationFn: async (rsvpId: string) => {
			const response = await eventadminDeleteRsvp({
				path: { event_id: data.event.id, rsvp_id: rsvpId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(m['attendeesAdmin.error_failedToDelete']());
			}

			return response.data;
		},
		onSuccess: () => {
			// Close dialog
			showDeleteDialog = false;
			deletingRsvp = null;

			// Reload page
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(`${m['attendeesAdmin.error_failedToDelete']()}: ${error.message}`);
		}
	}));

	/**
	 * Apply filters and navigate to update URL
	 */
	function applyFilters() {
		const params = new URLSearchParams();

		if (searchQuery) params.set('search', searchQuery);
		if (activeStatusFilter) params.set('status', activeStatusFilter);

		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Handle search input with debounce
	 */
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchInput = target.value;

		// Debounce search
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchQuery = searchInput;
			applyFilters();
		}, 500);
	}

	/**
	 * Filter by status
	 */
	function filterByStatus(status: string | null) {
		activeStatusFilter = status;
		applyFilters();
	}

	/**
	 * Navigate to page
	 */
	function goToPage(page: number) {
		const params = new URLSearchParams(window.location.search);
		params.set('page', page.toString());
		goto(`?${params.toString()}`, { keepFocus: true });
	}

	/**
	 * Open edit modal
	 */
	function openEditModal(rsvp: RsvpDetailSchema) {
		editingRsvp = rsvp;
		selectedStatus = rsvp.status as 'yes' | 'maybe' | 'no';
		showEditModal = true;
	}

	/**
	 * Close edit modal
	 */
	function closeEditModal() {
		showEditModal = false;
		editingRsvp = null;
	}

	/**
	 * Submit RSVP update
	 */
	function submitRsvpUpdate() {
		if (!editingRsvp) return;

		updateRsvpMutation.mutate({
			rsvpId: editingRsvp.id,
			status: selectedStatus
		});
	}

	/**
	 * Open delete dialog
	 */
	function openDeleteDialog(rsvp: RsvpDetailSchema) {
		deletingRsvp = rsvp;
		showDeleteDialog = true;
	}

	/**
	 * Confirm delete
	 */
	function confirmDelete() {
		if (!deletingRsvp) return;
		deleteRsvpMutation.mutate(deletingRsvp.id);
	}

	/**
	 * Cancel delete
	 */
	function cancelDelete() {
		showDeleteDialog = false;
		deletingRsvp = null;
	}

	/**
	 * Format date
	 */
	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	/**
	 * Get status badge color
	 */
	function getStatusColor(status: string): string {
		switch (status) {
			case 'yes':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
			case 'maybe':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
			case 'no':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	/**
	 * Get status label
	 */
	function getStatusLabel(status: string): string {
		switch (status) {
			case 'yes':
				return m['attendeesAdmin.statusLabelYes']();
			case 'maybe':
				return m['attendeesAdmin.statusLabelMaybe']();
			case 'no':
				return m['attendeesAdmin.statusLabelNo']();
			default:
				return status;
		}
	}

	/**
	 * Get user display name
	 */
	function getUserDisplayName(user: any): string {
		if (user.preferred_name) return user.preferred_name;
		if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
		if (user.first_name) return user.first_name;
		// Fallback to email if available (backend might include it despite schema)
		if (user.email) return user.email;
		return 'Unknown User';
	}

	/**
	 * Get user email (might not be available in schema)
	 */
	function getUserEmail(user: any): string {
		return user.email || 'N/A';
	}
</script>

<svelte:head>
	<title>Manage Attendees - {data.event.name} | {organization.name} | Revel</title>
	<meta name="description" content="Manage RSVPs for {data.event.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<div class="mb-4">
			<a
				href="/org/{organization.slug}/admin/events"
				class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				{m['attendeesAdmin.backToEvents']()}
			</a>
		</div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">{m['attendeesAdmin.pageTitle']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{data.event.name}</p>
	</div>

	<!-- Stats (always shown) -->
	<div class="space-y-4">
		<!-- Warning for incomplete data -->
		{#if hasMultiplePages}
			<div
				class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
				role="alert"
			>
				<svg class="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
						clip-rule="evenodd"
					/>
				</svg>
				<div class="text-sm">
					<p class="font-medium">{m['attendeesAdmin.warningIncompleteData']()}</p>
					<p>{m['attendeesAdmin.warningTotalRsvps']({ total: data.totalCount })}</p>
				</div>
			</div>
		{/if}

		<!-- Stats grid -->
		<div class="grid gap-4 sm:grid-cols-4">
			<div class="rounded-lg border border-border bg-card p-4">
				<p class="text-sm font-medium text-muted-foreground">{m['attendeesAdmin.statsTotal']()}</p>
				<p class="mt-1 text-2xl font-bold">{stats.total}</p>
			</div>
			<div
				class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
			>
				<p class="text-sm font-medium text-green-700 dark:text-green-300">{m['attendeesAdmin.statsYes']()}</p>
				<p class="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">{stats.yesCount}</p>
			</div>
			<div
				class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
			>
				<p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">{m['attendeesAdmin.statsMaybe']()}</p>
				<p class="mt-1 text-2xl font-bold text-yellow-900 dark:text-yellow-100">
					{stats.maybeCount}
				</p>
			</div>
			<div
				class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
			>
				<p class="text-sm font-medium text-red-700 dark:text-red-300">{m['attendeesAdmin.statsNo']()}</p>
				<p class="mt-1 text-2xl font-bold text-red-900 dark:text-red-100">{stats.noCount}</p>
			</div>
		</div>
	</div>

	<!-- Filters & Search -->
	<div class="space-y-4">
		<!-- Search bar -->
		<div class="relative">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				type="search"
				placeholder={m['attendeesAdmin.searchPlaceholder']()}
				value={searchInput}
				oninput={handleSearchInput}
				class="pl-10"
			/>
		</div>

		<!-- Filter buttons -->
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => filterByStatus(null)}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					!activeStatusFilter
						? 'bg-primary text-primary-foreground'
						: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
				)}
			>
				{m['attendeesAdmin.filterAll']({ count: data.totalCount })}
			</button>
			<button
				type="button"
				onclick={() => filterByStatus('yes')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'yes'
						? 'bg-green-600 text-white'
						: 'border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
				)}
			>
				{m['attendeesAdmin.statsYes']()}
			</button>
			<button
				type="button"
				onclick={() => filterByStatus('maybe')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'maybe'
						? 'bg-yellow-600 text-white'
						: 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
				)}
			>
				{m['attendeesAdmin.statsMaybe']()}
			</button>
			<button
				type="button"
				onclick={() => filterByStatus('no')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'no'
						? 'bg-red-600 text-white'
						: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
				)}
			>
				{m['attendeesAdmin.statsNo']()}
			</button>
		</div>
	</div>

	<!-- Attendees list -->
	{#if data.rsvps.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">{m['attendeesAdmin.noRsvpsHeading']()}</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{#if activeStatusFilter || searchQuery}
					{m['attendeesAdmin.noRsvpsFiltered']()}
				{:else}
					{m['attendeesAdmin.noRsvpsEmpty']()}
				{/if}
			</p>
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="hidden overflow-hidden rounded-lg border border-border md:block">
			<table class="w-full">
				<thead class="bg-muted/50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m['attendeesAdmin.tableHeaderName']()}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m['attendeesAdmin.tableHeaderEmail']()}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m['attendeesAdmin.tableHeaderStatus']()}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m['attendeesAdmin.tableHeaderRsvpDate']()}
						</th>
						<th
							class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m['attendeesAdmin.tableHeaderActions']()}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border bg-card">
					{#each data.rsvps as rsvp (rsvp.id)}
						<tr class="hover:bg-muted/50">
							<td class="whitespace-nowrap px-6 py-4 text-sm font-medium">
								{getUserDisplayName(rsvp.user)}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
								{getUserEmail(rsvp.user)}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm">
								<span
									class={cn(
										'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
										getStatusColor(rsvp.status)
									)}
								>
									{getStatusLabel(rsvp.status)}
								</span>
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
								{formatDate(rsvp.created_at)}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-right text-sm">
								<div class="flex items-center justify-end gap-2">
									<button
										type="button"
										onclick={() => openEditModal(rsvp)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
										aria-label="Edit RSVP for {getUserDisplayName(rsvp.user)}"
									>
										<Edit class="h-3 w-3" aria-hidden="true" />
										{m['attendeesAdmin.actionEdit']()}
									</button>
									<button
										type="button"
										onclick={() => openDeleteDialog(rsvp)}
										class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
										aria-label="Delete RSVP for {getUserDisplayName(rsvp.user)}"
									>
										<Trash2 class="h-3 w-3" aria-hidden="true" />
										{m['attendeesAdmin.actionDelete']()}
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<div class="space-y-4 md:hidden">
			{#each data.rsvps as rsvp (rsvp.id)}
				<div class="rounded-lg border border-border bg-card p-4">
					<div class="space-y-3">
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="font-medium">{getUserDisplayName(rsvp.user)}</p>
								<p class="text-sm text-muted-foreground">{getUserEmail(rsvp.user)}</p>
							</div>
							<span
								class={cn(
									'rounded-full px-2 py-1 text-xs font-semibold',
									getStatusColor(rsvp.status)
								)}
							>
								{getStatusLabel(rsvp.status)}
							</span>
						</div>

						<p class="text-xs text-muted-foreground">{m['attendeesAdmin.mobileRsvpdOn']({ date: formatDate(rsvp.created_at) })}</p>

						<div class="flex gap-2 border-t border-border pt-3">
							<button
								type="button"
								onclick={() => openEditModal(rsvp)}
								class="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
							>
								<Edit class="h-4 w-4" aria-hidden="true" />
								{m['attendeesAdmin.actionEdit']()}
							</button>
							<button
								type="button"
								onclick={() => openDeleteDialog(rsvp)}
								class="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
							>
								<Trash2 class="h-4 w-4" aria-hidden="true" />
								{m['attendeesAdmin.actionDelete']()}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.previousPage || data.nextPage}
			<div class="flex items-center justify-between border-t border-border pt-4">
				<div class="text-sm text-muted-foreground">
					{m['attendeesAdmin.paginationShowing']({
						from: (data.currentPage - 1) * data.pageSize + 1,
						to: Math.min(data.currentPage * data.pageSize, data.totalCount),
						total: data.totalCount
					})}
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={!data.previousPage}
						onclick={() => goToPage(data.currentPage - 1)}
					>
						<ChevronLeft class="h-4 w-4" aria-hidden="true" />
						{m['attendeesAdmin.paginationPrevious']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!data.nextPage}
						onclick={() => goToPage(data.currentPage + 1)}
					>
						{m['attendeesAdmin.paginationNext']()}
						<ChevronRight class="h-4 w-4" aria-hidden="true" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Edit RSVP Modal -->
<Dialog.Root bind:open={showEditModal}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m['attendeesAdmin.editModalTitle']()}</Dialog.Title>
			<Dialog.Description>
				{#if editingRsvp}
					{m['attendeesAdmin.editModalDescription']({ name: getUserDisplayName(editingRsvp.user) })}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if editingRsvp}
			<div class="space-y-4 py-4">
				<!-- Current info -->
				<div class="rounded-lg bg-muted p-3">
					<p class="text-sm font-medium">{m['attendeesAdmin.editModalCurrentStatus']()}</p>
					<p class="mt-1">
						<span
							class={cn(
								'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
								getStatusColor(editingRsvp.status)
							)}
						>
							{getStatusLabel(editingRsvp.status)}
						</span>
					</p>
				</div>

				<!-- New status selection -->
				<div class="space-y-2">
					<label class="text-sm font-medium">{m['attendeesAdmin.editModalNewStatus']()}</label>
					<div class="space-y-2">
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="yes"
								bind:group={selectedStatus}
								class="h-4 w-4 text-green-600 focus:ring-green-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalYesLabel']()}</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="maybe"
								bind:group={selectedStatus}
								class="h-4 w-4 text-yellow-600 focus:ring-yellow-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalMaybeLabel']()}</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="no"
								bind:group={selectedStatus}
								class="h-4 w-4 text-red-600 focus:ring-red-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalNoLabel']()}</span>
						</label>
					</div>
				</div>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={closeEditModal}>{m['attendeesAdmin.editModalCancel']()}</Button>
				<Button
					onclick={submitRsvpUpdate}
					disabled={updateRsvpMutation.isPending || selectedStatus === (editingRsvp.status as any)}
				>
					{updateRsvpMutation.isPending ? m['attendeesAdmin.editModalUpdating']() : m['attendeesAdmin.editModalUpdate']()}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<ConfirmDialog
	isOpen={showDeleteDialog}
	title={m['attendeesAdmin.deleteDialogTitle']()}
	message={deletingRsvp
		? m['attendeesAdmin.deleteDialogMessage']({ name: getUserDisplayName(deletingRsvp.user) })
		: ''}
	confirmText={m['attendeesAdmin.deleteDialogConfirm']()}
	cancelText={m['attendeesAdmin.deleteDialogCancel']()}
	variant="danger"
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>
