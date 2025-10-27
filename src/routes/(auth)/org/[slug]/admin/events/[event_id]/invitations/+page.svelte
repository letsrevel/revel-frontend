<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema
	} from '$lib/api/generated/types.gen';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Users,
		Check,
		X,
		Calendar,
		AlertCircle,
		Search,
		ChevronLeft,
		Mail,
		UserPlus,
		Trash2,
		Plus,
		Edit,
		CheckSquare,
		Square,
		XCircle
	} from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Track which request/invitation is being processed
	let processingId = $state<string | null>(null);

	// Active tab state
	let activeTab = $state<'requests' | 'invitations'>(data.activeTab as any);

	// Filter states
	let activeStatusFilter = $state<string | null>(data.filters?.status || null);
	let searchQuery = $state(data.filters?.search || '');
	let searchInput = $state(searchQuery);

	// Create invitation form state
	let showCreateDialog = $state(false);
	let invitationEmails = $state('');
	let invitationMessage = $state('');
	let selectedTierId = $state('');
	let emailTags = $state<string[]>([]);
	let emailInputValue = $state('');

	// Edit invitation state
	let showEditDialog = $state(false);
	let editingInvitation = $state<
		EventInvitationListSchema | PendingEventInvitationListSchema | null
	>(null);
	let editingType = $state<'registered' | 'pending' | null>(null);
	let editFormData = $state({
		tier_id: '',
		waives_questionnaire: false,
		waives_purchase: false,
		waives_membership_required: false,
		waives_rsvp_deadline: false,
		overrides_max_attendees: false,
		custom_message: ''
	});

	// Bulk selection state
	let selectedRegisteredIds = $state<Set<string>>(new Set());
	let selectedPendingIds = $state<Set<string>>(new Set());
	let showBulkEditDialog = $state(false);
	let bulkEditFormData = $state({
		tier_id: '',
		waives_questionnaire: false,
		waives_purchase: false,
		waives_membership_required: false,
		waives_rsvp_deadline: false,
		overrides_max_attendees: false,
		custom_message: ''
	});

	// Format date helper
	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return dateString;
		}
	}

	// Get status badge styling
	function getStatusBadge(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
			case 'approved':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'rejected':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
		}
	}

	/**
	 * Switch tabs
	 */
	function switchTab(tab: 'requests' | 'invitations') {
		activeTab = tab;
		const params = new URLSearchParams(window.location.search);
		params.set('tab', tab);
		params.delete('page'); // Reset pagination
		params.delete('status'); // Reset filters
		params.delete('search');
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Apply filters
	 */
	function applyFilters() {
		const params = new URLSearchParams();
		params.set('tab', activeTab);
		if (activeStatusFilter) params.set('status', activeStatusFilter);
		if (searchQuery) params.set('search', searchQuery);
		window.location.href = `?${params.toString()}`;
	}

	/**
	 * Filter by status (for requests tab)
	 */
	function filterByStatus(status: string | null) {
		activeStatusFilter = status;
		applyFilters();
	}

	/**
	 * Handle search input with debounce
	 */
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

	/**
	 * Get user display name
	 */
	function getUserDisplayName(user: any): string {
		if (user.preferred_name) return user.preferred_name;
		if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
		if (user.first_name) return user.first_name;
		if (user.email) return user.email;
		return 'Unknown User';
	}

	/**
	 * Open create invitation dialog
	 */
	function openCreateDialog() {
		// Default to no tier (optional)
		selectedTierId = '';
		showCreateDialog = true;
	}

	/**
	 * Reset create form
	 */
	function resetCreateForm() {
		invitationEmails = '';
		invitationMessage = '';
		selectedTierId = '';
		emailTags = [];
		emailInputValue = '';
	}

	/**
	 * Add email tag
	 */
	function addEmailTag(email: string) {
		const trimmed = email.trim();
		if (trimmed && !emailTags.includes(trimmed)) {
			emailTags = [...emailTags, trimmed];
			updateEmailsString();
		}
	}

	/**
	 * Remove email tag
	 */
	function removeEmailTag(email: string) {
		emailTags = emailTags.filter((e) => e !== email);
		updateEmailsString();
	}

	/**
	 * Handle email input keydown
	 */
	function handleEmailKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
			e.preventDefault();
			if (emailInputValue.trim()) {
				addEmailTag(emailInputValue);
				emailInputValue = '';
			}
		} else if (e.key === 'Backspace' && !emailInputValue && emailTags.length > 0) {
			// Remove last tag if input is empty and backspace is pressed
			emailTags = emailTags.slice(0, -1);
			updateEmailsString();
		}
	}

	/**
	 * Handle email input blur - add any remaining text as tag
	 */
	function handleEmailBlur() {
		if (emailInputValue.trim()) {
			addEmailTag(emailInputValue);
			emailInputValue = '';
		}
	}

	/**
	 * Handle email input paste
	 */
	function handleEmailPaste(e: ClipboardEvent) {
		e.preventDefault();
		const pastedText = e.clipboardData?.getData('text') || '';
		const emails = pastedText
			.split(/[\n,\s]+/)
			.map((e) => e.trim())
			.filter((e) => e.length > 0);

		emails.forEach((email) => addEmailTag(email));
		emailInputValue = '';
	}

	/**
	 * Update the hidden emails string from tags
	 */
	function updateEmailsString() {
		invitationEmails = emailTags.join('\n');
	}

	/**
	 * Open edit dialog for single invitation
	 */
	function openEditDialog(
		invitation: EventInvitationListSchema | PendingEventInvitationListSchema,
		type: 'registered' | 'pending'
	) {
		editingInvitation = invitation;
		editingType = type;
		editFormData = {
			tier_id: invitation.tier?.id || '',
			waives_questionnaire: invitation.waives_questionnaire,
			waives_purchase: invitation.waives_purchase,
			waives_membership_required: invitation.waives_membership_required,
			waives_rsvp_deadline: invitation.waives_rsvp_deadline,
			overrides_max_attendees: invitation.overrides_max_attendees,
			custom_message: invitation.custom_message || ''
		};
		showEditDialog = true;
	}

	/**
	 * Reset edit form
	 */
	function resetEditForm() {
		editingInvitation = null;
		editingType = null;
		editFormData = {
			tier_id: '',
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
	}

	/**
	 * Toggle selection for registered invitation
	 */
	function toggleRegisteredSelection(id: string) {
		const newSet = new Set(selectedRegisteredIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedRegisteredIds = newSet;
	}

	/**
	 * Toggle selection for pending invitation
	 */
	function togglePendingSelection(id: string) {
		const newSet = new Set(selectedPendingIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedPendingIds = newSet;
	}

	/**
	 * Select all registered invitations
	 */
	function toggleSelectAllRegistered() {
		if (selectedRegisteredIds.size === data.registeredInvitations.length) {
			selectedRegisteredIds = new Set();
		} else {
			selectedRegisteredIds = new Set(data.registeredInvitations.map((inv) => inv.id));
		}
	}

	/**
	 * Select all pending invitations
	 */
	function toggleSelectAllPending() {
		if (selectedPendingIds.size === data.pendingInvitations.length) {
			selectedPendingIds = new Set();
		} else {
			selectedPendingIds = new Set(data.pendingInvitations.map((inv) => inv.id));
		}
	}

	/**
	 * Open bulk edit dialog
	 */
	function openBulkEditDialog() {
		// Initialize with no tier (optional)
		bulkEditFormData = {
			tier_id: '',
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
		showBulkEditDialog = true;
	}

	/**
	 * Reset bulk edit form
	 */
	function resetBulkEditForm() {
		bulkEditFormData = {
			tier_id: '',
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
	}

	/**
	 * Clear all selections
	 */
	function clearSelections() {
		selectedRegisteredIds = new Set();
		selectedPendingIds = new Set();
	}

	/**
	 * Get total selected count
	 */
	let totalSelected = $derived(selectedRegisteredIds.size + selectedPendingIds.size);
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
				Back to Events
			</a>
		</div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Manage Invitations</h1>
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
					Request approved successfully.
				{:else if form.action === 'rejected'}
					Request rejected successfully.
				{:else if form.action === 'created'}
					{form.data?.registered_count || 0} invitation(s) sent to registered users,
					{form.data?.pending_count || 0} invitation(s) sent to unregistered emails.
				{:else if form.action === 'deleted'}
					Invitation deleted successfully.
				{:else if form.action === 'updated'}
					Invitation updated successfully.
				{:else if form.action === 'bulk_updated'}
					{form.count || 0} invitation(s) updated successfully.
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
		<nav class="-mb-px flex space-x-8" aria-label="Tabs">
			<button
				type="button"
				onclick={() => switchTab('requests')}
				class={cn(
					'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
					activeTab === 'requests'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
				)}
			>
				<div class="flex items-center gap-2">
					<Mail class="h-4 w-4" aria-hidden="true" />
					Invitation Requests
					<span
						class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>
						{data.requestsPagination.totalCount}
					</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => switchTab('invitations')}
				class={cn(
					'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
					activeTab === 'invitations'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
				)}
			>
				<div class="flex items-center gap-2">
					<UserPlus class="h-4 w-4" aria-hidden="true" />
					Direct Invitations
					<span
						class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>
						{data.registeredPagination.totalCount + data.pendingPagination.totalCount}
					</span>
				</div>
			</button>
		</nav>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'requests'}
		<!-- INVITATION REQUESTS TAB -->
		<div class="space-y-4">
			<!-- Filters & Search -->
			<div class="space-y-4">
				<!-- Search bar -->
				<div class="relative">
					<Search
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						placeholder="Search by name or email..."
						value={searchInput}
						oninput={handleSearchInput}
						class="w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
						All ({data.requestsPagination.totalCount})
					</button>
					<button
						type="button"
						onclick={() => filterByStatus('pending')}
						class={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							activeStatusFilter === 'pending'
								? 'bg-yellow-600 text-white'
								: 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
						)}
					>
						Pending
					</button>
					<button
						type="button"
						onclick={() => filterByStatus('approved')}
						class={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							activeStatusFilter === 'approved'
								? 'bg-green-600 text-white'
								: 'border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
						)}
					>
						Approved
					</button>
					<button
						type="button"
						onclick={() => filterByStatus('rejected')}
						class={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							activeStatusFilter === 'rejected'
								? 'bg-red-600 text-white'
								: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
						)}
					>
						Rejected
					</button>
				</div>
			</div>

			<!-- Requests List -->
			{#if data.invitationRequests.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<Users class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<h3 class="mb-2 text-lg font-semibold">No invitation requests</h3>
					<p class="text-sm text-muted-foreground">
						{#if activeStatusFilter || searchQuery}
							No invitation requests match your current filters.
						{:else}
							There are no invitation requests for this event at this time.
						{/if}
					</p>
				</div>
			{:else}
				<!-- Requests Table -->
				<div class="overflow-hidden rounded-lg border bg-card">
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="border-b bg-muted/50">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										User
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										Message
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										Requested
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each data.invitationRequests as request (request.id)}
									<tr class="transition-colors hover:bg-muted/50">
										<!-- User -->
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												{#if request.user.profile_picture}
													<img
														src={request.user.profile_picture}
														alt={getUserDisplayName(request.user)}
														class="h-10 w-10 rounded-full object-cover"
													/>
												{:else}
													<div
														class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground"
													>
														{request.user.first_name?.charAt(0) ||
															request.user.username?.charAt(0).toUpperCase() ||
															'?'}
													</div>
												{/if}
												<div>
													<p class="font-medium">
														{getUserDisplayName(request.user)}
													</p>
													{#if request.user.username}
														<p class="text-sm text-muted-foreground">@{request.user.username}</p>
													{/if}
												</div>
											</div>
										</td>

										<!-- Message -->
										<td class="max-w-xs px-6 py-4">
											{#if request.message}
												<p class="truncate text-sm">{request.message}</p>
											{:else}
												<p class="text-sm italic text-muted-foreground">No message</p>
											{/if}
										</td>

										<!-- Status -->
										<td class="px-6 py-4">
											<span
												class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getStatusBadge(
													request.status
												)}"
											>
												{request.status.charAt(0).toUpperCase() + request.status.slice(1)}
											</span>
										</td>

										<!-- Requested -->
										<td class="px-6 py-4">
											<div class="flex items-center gap-1 text-sm text-muted-foreground">
												<Calendar class="h-4 w-4" aria-hidden="true" />
												{formatDate(request.created_at)}
											</div>
										</td>

										<!-- Actions -->
										<td class="px-6 py-4 text-right">
											{#if request.status === 'pending'}
												<div class="flex items-center justify-end gap-2">
													<form
														method="POST"
														action="?/approveRequest"
														use:enhance={() => {
															processingId = request.id;
															return async ({ update }) => {
																await update();
																processingId = null;
															};
														}}
													>
														<input type="hidden" name="request_id" value={request.id} />
														<button
															type="submit"
															disabled={processingId === request.id}
															class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
														>
															<Check class="h-3.5 w-3.5" aria-hidden="true" />
															Approve
														</button>
													</form>

													<form
														method="POST"
														action="?/rejectRequest"
														use:enhance={() => {
															processingId = request.id;
															return async ({ update }) => {
																await update();
																processingId = null;
															};
														}}
													>
														<input type="hidden" name="request_id" value={request.id} />
														<button
															type="submit"
															disabled={processingId === request.id}
															class="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
														>
															<X class="h-3.5 w-3.5" aria-hidden="true" />
															Reject
														</button>
													</form>
												</div>
											{:else}
												<span class="text-sm text-muted-foreground">
													{request.status === 'approved' ? 'Approved' : 'Rejected'}
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Pagination -->
				{#if data.requestsPagination.totalPages > 1}
					<div class="flex items-center justify-between">
						<p class="text-sm text-muted-foreground">
							Showing {(data.requestsPagination.page - 1) * data.requestsPagination.pageSize + 1} to
							{Math.min(
								data.requestsPagination.page * data.requestsPagination.pageSize,
								data.requestsPagination.totalCount
							)} of {data.requestsPagination.totalCount} requests
						</p>

						<div class="flex gap-2">
							{#if data.requestsPagination.hasPrev}
								<a
									href="?tab=requests&page={data.requestsPagination.page - 1}&page_size={data
										.requestsPagination.pageSize}{activeStatusFilter
										? `&status=${activeStatusFilter}`
										: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
									class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									Previous
								</a>
							{/if}

							{#if data.requestsPagination.hasNext}
								<a
									href="?tab=requests&page={data.requestsPagination.page + 1}&page_size={data
										.requestsPagination.pageSize}{activeStatusFilter
										? `&status=${activeStatusFilter}`
										: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
									class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									Next
								</a>
							{/if}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<!-- DIRECT INVITATIONS TAB -->
		<div class="space-y-6">
			<!-- Action Buttons -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-sm text-muted-foreground">
					Directly invite users by email. Registered users will receive immediate access, while
					unregistered emails will get a signup link.
				</p>
				<div class="flex gap-2">
					{#if totalSelected > 0}
						<Button variant="outline" onclick={openBulkEditDialog}>
							<Edit class="h-4 w-4" aria-hidden="true" />
							Edit {totalSelected} Selected
						</Button>
					{/if}
					<Button onclick={openCreateDialog}>
						<Plus class="h-4 w-4" aria-hidden="true" />
						Create Invitations
					</Button>
				</div>
			</div>

			<!-- Search -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					type="search"
					placeholder="Search by name or email..."
					value={searchInput}
					oninput={handleSearchInput}
					class="w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				/>
			</div>

			<!-- Registered Invitations -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">
						Registered Users ({data.registeredPagination.totalCount})
					</h3>
					{#if selectedRegisteredIds.size > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-muted-foreground">
								{selectedRegisteredIds.size} selected
							</span>
							<Button size="sm" variant="outline" onclick={clearSelections}>Clear</Button>
						</div>
					{/if}
				</div>

				{#if data.registeredInvitations.length === 0}
					<div class="rounded-lg border bg-card p-8 text-center">
						<UserPlus class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">No invitations to registered users yet.</p>
					</div>
				{:else}
					<div class="overflow-hidden rounded-lg border bg-card">
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead class="border-b bg-muted/50">
									<tr>
										<th class="w-12 px-4 py-3">
											<button
												type="button"
												onclick={toggleSelectAllRegistered}
												class="flex items-center justify-center text-muted-foreground hover:text-foreground"
											>
												{#if selectedRegisteredIds.size === data.registeredInvitations.length && data.registeredInvitations.length > 0}
													<CheckSquare class="h-4 w-4" aria-hidden="true" />
												{:else}
													<Square class="h-4 w-4" aria-hidden="true" />
												{/if}
											</button>
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											User
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Email
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Tier
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Properties
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Created
										</th>
										<th
											class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Actions
										</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each data.registeredInvitations as invitation (invitation.id)}
										<tr class="transition-colors hover:bg-muted/50">
											<!-- Checkbox -->
											<td class="px-4 py-4">
												<button
													type="button"
													onclick={() => toggleRegisteredSelection(invitation.id)}
													class="flex items-center justify-center text-muted-foreground hover:text-foreground"
												>
													{#if selectedRegisteredIds.has(invitation.id)}
														<CheckSquare class="h-4 w-4" aria-hidden="true" />
													{:else}
														<Square class="h-4 w-4" aria-hidden="true" />
													{/if}
												</button>
											</td>

											<!-- User -->
											<td class="px-4 py-4">
												<div class="flex items-center gap-2">
													{#if invitation.user.profile_picture}
														<img
															src={invitation.user.profile_picture}
															alt={getUserDisplayName(invitation.user)}
															class="h-8 w-8 rounded-full object-cover"
														/>
													{:else}
														<div
															class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground"
														>
															{invitation.user.first_name?.charAt(0) || '?'}
														</div>
													{/if}
													<span class="text-sm font-medium">
														{getUserDisplayName(invitation.user)}
													</span>
												</div>
											</td>

											<!-- Email -->
											<td class="px-4 py-4 text-sm text-muted-foreground">
												{invitation.user.email || 'N/A'}
											</td>

											<!-- Tier -->
											<td class="px-4 py-4 text-sm">{invitation.tier?.name || 'No tier'}</td>

											<!-- Properties -->
											<td class="px-4 py-4">
												<div class="flex flex-wrap gap-1">
													{#if invitation.waives_questionnaire}
														<span
															class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
															title="Waives questionnaire requirement"
														>
															No Quest.
														</span>
													{/if}
													{#if invitation.waives_purchase}
														<span
															class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
															title="Waives purchase requirement (free ticket)"
														>
															Free
														</span>
													{/if}
													{#if invitation.waives_membership_required}
														<span
															class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
															title="Waives membership requirement"
														>
															No Member.
														</span>
													{/if}
													{#if invitation.waives_rsvp_deadline}
														<span
															class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
															title="Waives RSVP deadline"
														>
															No Deadline
														</span>
													{/if}
													{#if invitation.overrides_max_attendees}
														<span
															class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
															title="Overrides max attendees limit"
														>
															Override Cap
														</span>
													{/if}
													{#if invitation.custom_message}
														<span
															class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
															title={invitation.custom_message}
														>
															Has Message
														</span>
													{/if}
												</div>
											</td>

											<!-- Created -->
											<td class="px-4 py-4 text-sm text-muted-foreground">
												{formatDate(invitation.created_at)}
											</td>

											<!-- Actions -->
											<td class="px-4 py-4 text-right">
												<div class="flex items-center justify-end gap-2">
													<button
														type="button"
														onclick={() => openEditDialog(invitation, 'registered')}
														class="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
													>
														<Edit class="h-3 w-3" aria-hidden="true" />
														Edit
													</button>
													<form
														method="POST"
														action="?/deleteInvitation"
														use:enhance={() => {
															processingId = invitation.id;
															return async ({ update }) => {
																await update();
																processingId = null;
																selectedRegisteredIds.delete(invitation.id);
															};
														}}
													>
														<input type="hidden" name="invitation_id" value={invitation.id} />
														<input type="hidden" name="invitation_type" value="registered" />
														<button
															type="submit"
															disabled={processingId === invitation.id}
															class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
														>
															<Trash2 class="h-3 w-3" aria-hidden="true" />
															Delete
														</button>
													</form>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>

			<!-- Pending Invitations -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">
						Pending (Unregistered) ({data.pendingPagination.totalCount})
					</h3>
					{#if selectedPendingIds.size > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-muted-foreground">
								{selectedPendingIds.size} selected
							</span>
							<Button size="sm" variant="outline" onclick={clearSelections}>Clear</Button>
						</div>
					{/if}
				</div>

				{#if data.pendingInvitations.length === 0}
					<div class="rounded-lg border bg-card p-8 text-center">
						<Mail class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">
							No pending invitations to unregistered emails yet.
						</p>
					</div>
				{:else}
					<div class="overflow-hidden rounded-lg border bg-card">
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead class="border-b bg-muted/50">
									<tr>
										<th class="w-12 px-4 py-3">
											<button
												type="button"
												onclick={toggleSelectAllPending}
												class="flex items-center justify-center text-muted-foreground hover:text-foreground"
											>
												{#if selectedPendingIds.size === data.pendingInvitations.length && data.pendingInvitations.length > 0}
													<CheckSquare class="h-4 w-4" aria-hidden="true" />
												{:else}
													<Square class="h-4 w-4" aria-hidden="true" />
												{/if}
											</button>
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Email
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Tier
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Properties
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Created
										</th>
										<th
											class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											Actions
										</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each data.pendingInvitations as invitation (invitation.id)}
										<tr class="transition-colors hover:bg-muted/50">
											<!-- Checkbox -->
											<td class="px-4 py-4">
												<button
													type="button"
													onclick={() => togglePendingSelection(invitation.id)}
													class="flex items-center justify-center text-muted-foreground hover:text-foreground"
												>
													{#if selectedPendingIds.has(invitation.id)}
														<CheckSquare class="h-4 w-4" aria-hidden="true" />
													{:else}
														<Square class="h-4 w-4" aria-hidden="true" />
													{/if}
												</button>
											</td>

											<!-- Email -->
											<td class="px-4 py-4 text-sm font-medium">{invitation.email}</td>

											<!-- Tier -->
											<td class="px-4 py-4 text-sm">{invitation.tier?.name || 'No tier'}</td>

											<!-- Properties -->
											<td class="px-4 py-4">
												<div class="flex flex-wrap gap-1">
													{#if invitation.waives_questionnaire}
														<span
															class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
															title="Waives questionnaire requirement"
														>
															No Quest.
														</span>
													{/if}
													{#if invitation.waives_purchase}
														<span
															class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
															title="Waives purchase requirement (free ticket)"
														>
															Free
														</span>
													{/if}
													{#if invitation.waives_membership_required}
														<span
															class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
															title="Waives membership requirement"
														>
															No Member.
														</span>
													{/if}
													{#if invitation.waives_rsvp_deadline}
														<span
															class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
															title="Waives RSVP deadline"
														>
															No Deadline
														</span>
													{/if}
													{#if invitation.overrides_max_attendees}
														<span
															class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
															title="Overrides max attendees limit"
														>
															Override Cap
														</span>
													{/if}
													{#if invitation.custom_message}
														<span
															class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
															title={invitation.custom_message}
														>
															Has Message
														</span>
													{/if}
												</div>
											</td>

											<!-- Created -->
											<td class="px-4 py-4 text-sm text-muted-foreground">
												{formatDate(invitation.created_at)}
											</td>

											<!-- Actions -->
											<td class="px-4 py-4 text-right">
												<div class="flex items-center justify-end gap-2">
													<button
														type="button"
														onclick={() => openEditDialog(invitation, 'pending')}
														class="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
													>
														<Edit class="h-3 w-3" aria-hidden="true" />
														Edit
													</button>
													<form
														method="POST"
														action="?/deleteInvitation"
														use:enhance={() => {
															processingId = invitation.id;
															return async ({ update }) => {
																await update();
																processingId = null;
																selectedPendingIds.delete(invitation.id);
															};
														}}
													>
														<input type="hidden" name="invitation_id" value={invitation.id} />
														<input type="hidden" name="invitation_type" value="pending" />
														<button
															type="submit"
															disabled={processingId === invitation.id}
															class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
														>
															<Trash2 class="h-3 w-3" aria-hidden="true" />
															Delete
														</button>
													</form>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Create Invitation Dialog -->
<Dialog.Root open={showCreateDialog} onOpenChange={(open) => (showCreateDialog = open)}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>Create Invitations</Dialog.Title>
			<Dialog.Description>
				Invite users by email address. Enter one email per line or separated by commas.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/createInvitations"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetCreateForm();
					showCreateDialog = false;
				};
			}}
			class="space-y-4"
		>
			<!-- Hidden email input for form submission -->
			<input type="hidden" name="emails" value={invitationEmails} />

			<!-- Email addresses with tag input -->
			<div>
				<label class="block text-sm font-medium">Email Addresses *</label>
				<div
					class="mt-1 flex min-h-[80px] flex-wrap gap-2 rounded-md border-2 border-gray-300 bg-white p-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 dark:border-gray-600 dark:bg-gray-800"
				>
					{#each emailTags as email (email)}
						<span
							class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary dark:bg-primary/20"
						>
							{email}
							<button
								type="button"
								onclick={() => removeEmailTag(email)}
								class="rounded-sm hover:bg-primary/20 dark:hover:bg-primary/30"
								aria-label="Remove {email}"
							>
								<XCircle class="h-3.5 w-3.5" aria-hidden="true" />
							</button>
						</span>
					{/each}
					<input
						type="text"
						bind:value={emailInputValue}
						onkeydown={handleEmailKeydown}
						onblur={handleEmailBlur}
						onpaste={handleEmailPaste}
						placeholder={emailTags.length === 0 ? 'user1@example.com, user2@example.com...' : ''}
						class="min-w-[200px] flex-1 border-0 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground dark:text-gray-100"
					/>
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					Type emails and press Enter, comma, or space to add. Paste multiple emails to add them all
					at once.
				</p>
			</div>

			<!-- Tier selection (only for ticketed events) -->
			{#if data.event.requires_ticket}
				<div>
					<label for="tier_id" class="block text-sm font-medium">
						Ticket Tier (Optional - required if waiving purchase)
					</label>
					{#if data.event.tiers && data.event.tiers.length > 0}
						<select
							id="tier_id"
							name="tier_id"
							bind:value={selectedTierId}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						>
							<option value="">None</option>
							{#each data.event.tiers as tier (tier.id)}
								<option value={tier.id}>
									{tier.name}
									{#if tier.price_cents !== null && tier.price_cents !== undefined}
										- €{(tier.price_cents / 100).toFixed(2)}
									{:else}
										- Free
									{/if}
								</option>
							{/each}
						</select>
					{:else}
						<div
							class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
						>
							No tiers configured for this event
						</div>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">
						Select a tier to grant access when waiving purchase requirement
					</p>
				</div>
			{/if}

			<!-- Custom message -->
			<div>
				<label for="custom_message" class="block text-sm font-medium">
					Custom Message (Optional)
				</label>
				<textarea
					id="custom_message"
					name="custom_message"
					bind:value={invitationMessage}
					placeholder="Add a personal message to the invitation email..."
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">{invitationMessage.length}/500 characters</p>
			</div>

			<!-- Invitation properties -->
			<div class="space-y-3 rounded-lg border border-border p-4">
				<h4 class="text-sm font-semibold">Invitation Properties</h4>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_questionnaire"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive questionnaire requirement</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_purchase"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive purchase requirement (free ticket)</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_membership_required"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive membership requirement</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_rsvp_deadline"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive RSVP deadline</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="overrides_max_attendees"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Override max attendees limit</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showCreateDialog = false)}>
					Cancel
				</Button>
				<Button type="submit">
					<Mail class="mr-2 h-4 w-4" aria-hidden="true" />
					Send Invitations
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Invitation Dialog -->
<Dialog.Root
	open={showEditDialog}
	onOpenChange={(open) => {
		showEditDialog = open;
		if (!open) resetEditForm();
	}}
>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>Edit Invitation</Dialog.Title>
			<Dialog.Description>
				{#if editingInvitation}
					{#if editingType === 'registered' && 'user' in editingInvitation}
						Editing invitation for {getUserDisplayName(editingInvitation.user)}
					{:else if editingType === 'pending' && 'email' in editingInvitation}
						Editing invitation for {editingInvitation.email}
					{/if}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/updateInvitation"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetEditForm();
					showEditDialog = false;
				};
			}}
			class="space-y-4"
		>
			{#if editingInvitation}
				<!-- Hidden email field -->
				{#if editingType === 'registered' && 'user' in editingInvitation}
					<input type="hidden" name="email" value={editingInvitation.user.email || ''} />
				{:else if editingType === 'pending' && 'email' in editingInvitation}
					<input type="hidden" name="email" value={editingInvitation.email} />
				{/if}

				<!-- Tier selection (only for ticketed events) -->
				{#if data.event.requires_ticket}
					<div>
						<label for="edit_tier_id" class="block text-sm font-medium">
							Ticket Tier (Optional - required if waiving purchase)
						</label>
						{#if data.event.tiers && data.event.tiers.length > 0}
							<select
								id="edit_tier_id"
								name="tier_id"
								bind:value={editFormData.tier_id}
								class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							>
								<option value="">None</option>
								{#each data.event.tiers as tier (tier.id)}
									<option value={tier.id}>
										{tier.name}
										{#if tier.price_cents !== null && tier.price_cents !== undefined}
											- €{(tier.price_cents / 100).toFixed(2)}
										{:else}
											- Free
										{/if}
									</option>
								{/each}
							</select>
						{:else}
							<div
								class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
							>
								No tiers configured for this event
							</div>
						{/if}
						<p class="mt-1 text-xs text-muted-foreground">
							Select a tier to grant access when waiving purchase requirement
						</p>
					</div>
				{/if}

				<!-- Custom message -->
				<div>
					<label for="edit_custom_message" class="block text-sm font-medium">
						Custom Message (Optional)
					</label>
					<textarea
						id="edit_custom_message"
						name="custom_message"
						bind:value={editFormData.custom_message}
						placeholder="Add a personal message to the invitation email..."
						rows="3"
						maxlength="500"
						class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					></textarea>
					<p class="mt-1 text-xs text-muted-foreground">
						{editFormData.custom_message.length}/500 characters
					</p>
				</div>

				<!-- Invitation properties -->
				<div class="space-y-3 rounded-lg border border-border p-4">
					<h4 class="text-sm font-semibold">Invitation Properties</h4>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_questionnaire"
							value="true"
							bind:checked={editFormData.waives_questionnaire}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">Waive questionnaire requirement</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_purchase"
							value="true"
							bind:checked={editFormData.waives_purchase}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">Waive purchase requirement (free ticket)</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_membership_required"
							value="true"
							bind:checked={editFormData.waives_membership_required}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">Waive membership requirement</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_rsvp_deadline"
							value="true"
							bind:checked={editFormData.waives_rsvp_deadline}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">Waive RSVP deadline</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="overrides_max_attendees"
							value="true"
							bind:checked={editFormData.overrides_max_attendees}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">Override max attendees limit</span>
					</label>
				</div>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showEditDialog = false)}>
					Cancel
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					Update Invitation
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Bulk Edit Dialog -->
<Dialog.Root
	open={showBulkEditDialog}
	onOpenChange={(open) => {
		showBulkEditDialog = open;
		if (!open) resetBulkEditForm();
	}}
>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>Bulk Edit Invitations</Dialog.Title>
			<Dialog.Description>
				Update {totalSelected} selected invitation{totalSelected === 1 ? '' : 's'}. All selected
				invitations will be updated with the same properties.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/bulkUpdateInvitations"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetBulkEditForm();
					showBulkEditDialog = false;
					clearSelections();
				};
			}}
			class="space-y-4"
		>
			<!-- Hidden emails field (JSON array) -->
			<input
				type="hidden"
				name="emails"
				value={JSON.stringify([
					...Array.from(selectedRegisteredIds)
						.map((id) => data.registeredInvitations.find((inv) => inv.id === id)?.user?.email)
						.filter((e) => e),
					...Array.from(selectedPendingIds)
						.map((id) => data.pendingInvitations.find((inv) => inv.id === id)?.email)
						.filter((e) => e)
				])}
			/>

			<!-- Tier selection (only for ticketed events) -->
			{#if data.event.requires_ticket}
				<div>
					<label for="bulk_tier_id" class="block text-sm font-medium">
						Ticket Tier (Optional - required if waiving purchase)
					</label>
					{#if data.event.tiers && data.event.tiers.length > 0}
						<select
							id="bulk_tier_id"
							name="tier_id"
							bind:value={bulkEditFormData.tier_id}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						>
							<option value="">None</option>
							{#each data.event.tiers as tier (tier.id)}
								<option value={tier.id}>
									{tier.name}
									{#if tier.price_cents !== null && tier.price_cents !== undefined}
										- €{(tier.price_cents / 100).toFixed(2)}
									{:else}
										- Free
									{/if}
								</option>
							{/each}
						</select>
					{:else}
						<div
							class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
						>
							No tiers configured for this event
						</div>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">
						Select a tier to grant access when waiving purchase requirement
					</p>
				</div>
			{/if}

			<!-- Custom message -->
			<div>
				<label for="bulk_custom_message" class="block text-sm font-medium">
					Custom Message (Optional)
				</label>
				<textarea
					id="bulk_custom_message"
					name="custom_message"
					bind:value={bulkEditFormData.custom_message}
					placeholder="Add a personal message to the invitation email..."
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">
					{bulkEditFormData.custom_message.length}/500 characters
				</p>
			</div>

			<!-- Invitation properties -->
			<div class="space-y-3 rounded-lg border border-border p-4">
				<h4 class="text-sm font-semibold">Invitation Properties</h4>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_questionnaire"
						value="true"
						bind:checked={bulkEditFormData.waives_questionnaire}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive questionnaire requirement</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_purchase"
						value="true"
						bind:checked={bulkEditFormData.waives_purchase}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive purchase requirement (free ticket)</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_membership_required"
						value="true"
						bind:checked={bulkEditFormData.waives_membership_required}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive membership requirement</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_rsvp_deadline"
						value="true"
						bind:checked={bulkEditFormData.waives_rsvp_deadline}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Waive RSVP deadline</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="overrides_max_attendees"
						value="true"
						bind:checked={bulkEditFormData.overrides_max_attendees}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">Override max attendees limit</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showBulkEditDialog = false)}>
					Cancel
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					Update {totalSelected} Invitation{totalSelected === 1 ? '' : 's'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
