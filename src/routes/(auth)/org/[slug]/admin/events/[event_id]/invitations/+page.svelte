<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema,
		EventTokenSchema,
		EventTokenCreateSchema,
		EventTokenUpdateSchema
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
		XCircle,
		Link,
		Loader2
	} from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadmintokensListEventTokens,
		eventadmintokensCreateEventToken,
		eventadmintokensUpdateEventToken,
		eventadmintokensDeleteEventToken,
		organizationadminmembersListMembers
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import EventTokenCard from '$lib/components/tokens/EventTokenCard.svelte';
	import EventTokenModal from '$lib/components/tokens/EventTokenModal.svelte';
	import TokenShareDialog from '$lib/components/tokens/TokenShareDialog.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { getEventTokenUrl } from '$lib/utils/tokens';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Track which request/invitation is being processed
	let processingId = $state<string | null>(null);

	// Active tab state
	let activeTab = $state<'requests' | 'invitations' | 'links'>(data.activeTab as any);

	// Token-related state
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	let tokenSearchQuery = $state('');
	let isCreateTokenModalOpen = $state(false);
	let tokenToEdit = $state<EventTokenSchema | null>(null);
	let tokenToDelete = $state<EventTokenSchema | null>(null);
	let tokenToShare = $state<EventTokenSchema | null>(null);

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
	let emailSuggestions = $state<Array<{ email: string; name: string }>>([]);
	let showEmailSuggestions = $state(false);
	let selectedEmailIndex = $state(-1);
	let isLoadingEmailSuggestions = $state(false);
	let emailSearchTimeout: ReturnType<typeof setTimeout> | null = null;

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
	function switchTab(tab: 'requests' | 'invitations' | 'links') {
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
		return m['eventInvitationsAdmin.unknownUser']();
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
		emailSuggestions = [];
		showEmailSuggestions = false;
		selectedEmailIndex = -1;
	}

	/**
	 * Fetch email suggestions from organization members
	 */
	async function fetchEmailSuggestions(search: string): Promise<void> {
		if (!search.trim() || search.length < 2) {
			emailSuggestions = [];
			showEmailSuggestions = false;
			return;
		}

		isLoadingEmailSuggestions = true;

		try {
			const response = await organizationadminmembersListMembers({
				path: { slug: data.organization.slug },
				query: { search, page_size: 10 },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});

			if (response.data?.results) {
				// Extract email and name, filter out already-added emails and those without email
				emailSuggestions = response.data.results
					.filter((member) => member.user.email && !emailTags.includes(member.user.email))
					.map((member) => ({
						email: member.user.email!,
						name:
							member.user.preferred_name ||
							[member.user.first_name, member.user.last_name].filter(Boolean).join(' ') ||
							member.user.email!
					}));
				showEmailSuggestions = emailSuggestions.length > 0;
				selectedEmailIndex = -1;
			}
		} catch (error) {
			console.error('Failed to fetch email suggestions:', error);
			emailSuggestions = [];
			showEmailSuggestions = false;
		} finally {
			isLoadingEmailSuggestions = false;
		}
	}

	/**
	 * Handle email input changes (with debouncing)
	 */
	function handleEmailInput(e: Event): void {
		const value = (e.target as HTMLInputElement).value;
		emailInputValue = value;

		// Clear previous timeout
		if (emailSearchTimeout) {
			clearTimeout(emailSearchTimeout);
		}

		// Debounce search by 300ms
		emailSearchTimeout = setTimeout(() => {
			fetchEmailSuggestions(value);
		}, 300);
	}

	/**
	 * Select an email suggestion
	 */
	function selectEmailSuggestion(email: string): void {
		addEmailTag(email);
		emailInputValue = '';
		emailSuggestions = [];
		showEmailSuggestions = false;
		selectedEmailIndex = -1;
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
			// If a suggestion is selected, use it; otherwise add the input value
			if (selectedEmailIndex >= 0 && emailSuggestions[selectedEmailIndex]) {
				selectEmailSuggestion(emailSuggestions[selectedEmailIndex].email);
			} else if (emailInputValue.trim()) {
				addEmailTag(emailInputValue);
				emailInputValue = '';
				emailSuggestions = [];
				showEmailSuggestions = false;
			}
		} else if (e.key === 'Backspace' && !emailInputValue && emailTags.length > 0) {
			// Remove last tag if input is empty and backspace is pressed
			emailTags = emailTags.slice(0, -1);
			updateEmailsString();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (showEmailSuggestions && emailSuggestions.length > 0) {
				selectedEmailIndex = Math.min(selectedEmailIndex + 1, emailSuggestions.length - 1);
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (showEmailSuggestions && emailSuggestions.length > 0) {
				selectedEmailIndex = Math.max(selectedEmailIndex - 1, -1);
			}
		} else if (e.key === 'Escape') {
			showEmailSuggestions = false;
			selectedEmailIndex = -1;
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

	// ========================================
	// TOKEN MANAGEMENT (for "Invitation Links" tab)
	// ========================================

	// Fetch tokens
	const tokensQuery = createQuery(() => ({
		queryKey: ['event', data.event.id, 'tokens', tokenSearchQuery],
		queryFn: async () => {
			const response = await eventadmintokensListEventTokens({
				path: { event_id: data.event.id },
				query: { search: tokenSearchQuery || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch tokens');
			}

			return response.data;
		},
		enabled: !!accessToken && activeTab === 'links'
	}));

	// Create token mutation
	const createTokenMutation = createMutation(() => ({
		mutationFn: async (tokenData: EventTokenCreateSchema) => {
			const response = await eventadmintokensCreateEventToken({
				path: { event_id: data.event.id },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['event', data.event.id, 'tokens']
			});
			isCreateTokenModalOpen = false;
			toast.success('Invitation link created successfully!');
		},
		onError: () => {
			toast.error('Failed to create invitation link');
		}
	}));

	// Update token mutation
	const updateTokenMutation = createMutation(() => ({
		mutationFn: async ({
			tokenId,
			data: tokenData
		}: {
			tokenId: string;
			data: EventTokenUpdateSchema;
		}) => {
			const response = await eventadmintokensUpdateEventToken({
				path: { event_id: data.event.id, token_id: tokenId },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['event', data.event.id, 'tokens']
			});
			tokenToEdit = null;
			toast.success('Invitation link updated successfully!');
		},
		onError: () => {
			toast.error('Failed to update invitation link');
		}
	}));

	// Delete token mutation
	const deleteTokenMutation = createMutation(() => ({
		mutationFn: async (tokenId: string) => {
			const response = await eventadmintokensDeleteEventToken({
				path: { event_id: data.event.id, token_id: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['event', data.event.id, 'tokens']
			});
			tokenToDelete = null;
			toast.success('Invitation link deleted successfully!');
		},
		onError: () => {
			toast.error('Failed to delete invitation link');
		}
	}));

	function handleCreateTokenSave(tokenData: EventTokenCreateSchema) {
		createTokenMutation.mutate(tokenData);
	}

	function handleEditTokenSave(tokenData: EventTokenUpdateSchema) {
		if (tokenToEdit?.id) {
			updateTokenMutation.mutate({ tokenId: tokenToEdit.id, data: tokenData });
		}
	}

	function handleDeleteToken() {
		if (tokenToDelete?.id) {
			deleteTokenMutation.mutate(tokenToDelete.id);
		}
	}

	const tokens = $derived(tokensQuery.data?.results || []);
	const isLoadingTokens = $derived(tokensQuery.isLoading);
	const shareUrl = $derived(
		tokenToShare
			? getEventTokenUrl(tokenToShare.id || '') // Claiming URL for sharing
			: ''
	);
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
					<span
						class="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground sm:px-2"
					>
						{tokens.length}
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
						{m['eventInvitationsAdmin.filterAll']({ count: data.requestsPagination.totalCount })}
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
						{m['eventInvitationsAdmin.filterPending']()}
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
						{m['eventInvitationsAdmin.filterApproved']()}
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
						{m['eventInvitationsAdmin.filterRejected']()}
					</button>
				</div>
			</div>

			<!-- Requests List -->
			{#if data.invitationRequests.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<Users class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<h3 class="mb-2 text-lg font-semibold">{m['eventInvitationsAdmin.noRequests']()}</h3>
					<p class="text-sm text-muted-foreground">
						{#if activeStatusFilter || searchQuery}
							{m['eventInvitationsAdmin.noRequestsFiltered']()}
						{:else}
							{m['eventInvitationsAdmin.noRequestsEmpty']()}
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
										{m['eventInvitationsAdmin.headerUser']()}
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										{m['eventInvitationsAdmin.headerMessage']()}
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										{m['eventInvitationsAdmin.headerStatus']()}
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										{m['eventInvitationsAdmin.headerRequested']()}
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										{m['eventInvitationsAdmin.headerActions']()}
									</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each data.invitationRequests as request (request.id)}
									<tr class="transition-colors hover:bg-muted/50">
										<!-- User -->
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												<UserAvatar
													profilePictureUrl={request.user.profile_picture_url}
													thumbnailUrl={request.user.profile_picture_thumbnail_url}
													displayName={getUserDisplayName(request.user)}
													firstName={request.user.first_name}
													lastName={request.user.last_name}
													size="md"
												/>
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
												<p class="text-sm italic text-muted-foreground">
													{m['eventInvitationsAdmin.noMessage']()}
												</p>
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
															{m['eventInvitationsAdmin.approve']()}
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
															{m['eventInvitationsAdmin.reject']()}
														</button>
													</form>
												</div>
											{:else}
												<span class="text-sm text-muted-foreground">
													{request.status === 'approved'
														? m['eventInvitationsAdmin.approved']()
														: m['eventInvitationsAdmin.rejected']()}
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
									{m['eventInvitationsAdmin.previous']()}
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
									{m['eventInvitationsAdmin.next']()}
								</a>
							{/if}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{:else if activeTab === 'invitations'}
		<!-- DIRECT INVITATIONS TAB -->
		<div class="space-y-6">
			<!-- Action Buttons -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-sm text-muted-foreground">
					{m['eventInvitationsAdmin.directInvitationsDescription']()}
				</p>
				<div class="flex gap-2">
					{#if totalSelected > 0}
						<Button variant="outline" onclick={openBulkEditDialog}>
							<Edit class="h-4 w-4" aria-hidden="true" />
							{m['eventInvitationsAdmin.editSelected']({ count: totalSelected })}
						</Button>
					{/if}
					<Button onclick={openCreateDialog}>
						<Plus class="h-4 w-4" aria-hidden="true" />
						{m['eventInvitationsAdmin.createInvitations']()}
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
						{m['eventInvitationsAdmin.registeredUsersTitle']({
							count: data.registeredPagination.totalCount
						})}
					</h3>
					{#if selectedRegisteredIds.size > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-muted-foreground">
								{m['eventInvitationsAdmin.selected']({ count: selectedRegisteredIds.size })}
							</span>
							<Button size="sm" variant="outline" onclick={clearSelections}
								>{m['eventInvitationsAdmin.clear']()}</Button
							>
						</div>
					{/if}
				</div>

				{#if data.registeredInvitations.length === 0}
					<div class="rounded-lg border bg-card p-8 text-center">
						<UserPlus class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">
							{m['eventInvitationsAdmin.noRegisteredInvitations']()}
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
											{m['eventInvitationsAdmin.headerUser']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerEmail']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerTier']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerProperties']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerCreated']()}
										</th>
										<th
											class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerActions']()}
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
													<UserAvatar
														profilePictureUrl={invitation.user.profile_picture_url}
														thumbnailUrl={invitation.user.profile_picture_thumbnail_url}
														displayName={getUserDisplayName(invitation.user)}
														firstName={invitation.user.first_name}
														lastName={invitation.user.last_name}
														size="sm"
													/>
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
											<td class="px-4 py-4 text-sm"
												>{invitation.tier?.name || m['eventInvitationsAdmin.noTier']()}</td
											>

											<!-- Properties -->
											<td class="px-4 py-4">
												<div class="flex flex-wrap gap-1">
													{#if invitation.waives_questionnaire}
														<span
															class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
															title="Waives questionnaire requirement"
														>
															{m['eventInvitationsAdmin.noQuestionnaire']()}
														</span>
													{/if}
													{#if invitation.waives_purchase}
														<span
															class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
															title="Waives purchase requirement (free ticket)"
														>
															{m['eventInvitationsAdmin.free']()}
														</span>
													{/if}
													{#if invitation.waives_membership_required}
														<span
															class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
															title="Waives membership requirement"
														>
															{m['eventInvitationsAdmin.noMembership']()}
														</span>
													{/if}
													{#if invitation.waives_rsvp_deadline}
														<span
															class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
															title="Waives RSVP deadline"
														>
															{m['eventInvitationsAdmin.noDeadline']()}
														</span>
													{/if}
													{#if invitation.overrides_max_attendees}
														<span
															class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
															title="Overrides max attendees limit"
														>
															{m['eventInvitationsAdmin.overrideCap']()}
														</span>
													{/if}
													{#if invitation.custom_message}
														<span
															class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
															title={invitation.custom_message}
														>
															Has {m['eventInvitationsAdmin.headerMessage']()}
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
														{m['eventInvitationsAdmin.edit']()}
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
															{m['eventInvitationsAdmin.delete']()}
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
						{m['eventInvitationsAdmin.pendingUsersTitle']({
							count: data.pendingPagination.totalCount
						})}
					</h3>
					{#if selectedPendingIds.size > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-muted-foreground">
								{m['eventInvitationsAdmin.selected']({ count: selectedPendingIds.size })}
							</span>
							<Button size="sm" variant="outline" onclick={clearSelections}
								>{m['eventInvitationsAdmin.clear']()}</Button
							>
						</div>
					{/if}
				</div>

				{#if data.pendingInvitations.length === 0}
					<div class="rounded-lg border bg-card p-8 text-center">
						<Mail class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">
							{m['eventInvitationsAdmin.noPendingInvitations']()}
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
											{m['eventInvitationsAdmin.headerEmail']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerTier']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerProperties']()}
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerCreated']()}
										</th>
										<th
											class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
										>
											{m['eventInvitationsAdmin.headerActions']()}
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
											<td class="px-4 py-4 text-sm"
												>{invitation.tier?.name || m['eventInvitationsAdmin.noTier']()}</td
											>

											<!-- Properties -->
											<td class="px-4 py-4">
												<div class="flex flex-wrap gap-1">
													{#if invitation.waives_questionnaire}
														<span
															class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
															title="Waives questionnaire requirement"
														>
															{m['eventInvitationsAdmin.noQuestionnaire']()}
														</span>
													{/if}
													{#if invitation.waives_purchase}
														<span
															class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
															title="Waives purchase requirement (free ticket)"
														>
															{m['eventInvitationsAdmin.free']()}
														</span>
													{/if}
													{#if invitation.waives_membership_required}
														<span
															class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
															title="Waives membership requirement"
														>
															{m['eventInvitationsAdmin.noMembership']()}
														</span>
													{/if}
													{#if invitation.waives_rsvp_deadline}
														<span
															class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
															title="Waives RSVP deadline"
														>
															{m['eventInvitationsAdmin.noDeadline']()}
														</span>
													{/if}
													{#if invitation.overrides_max_attendees}
														<span
															class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
															title="Overrides max attendees limit"
														>
															{m['eventInvitationsAdmin.overrideCap']()}
														</span>
													{/if}
													{#if invitation.custom_message}
														<span
															class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
															title={invitation.custom_message}
														>
															Has {m['eventInvitationsAdmin.headerMessage']()}
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
														{m['eventInvitationsAdmin.edit']()}
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
															{m['eventInvitationsAdmin.delete']()}
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
	{:else if activeTab === 'links'}
		<!-- INVITATION LINKS TAB -->
		<div class="space-y-6">
			<!-- Header & Action -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-sm text-muted-foreground">
					{m['eventInvitationsAdmin.linksDescription']()}
				</p>
				<Button onclick={() => (isCreateTokenModalOpen = true)}>
					<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.createLink']()}
				</Button>
			</div>

			<!-- Search -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					type="search"
					placeholder={m['eventInvitationsAdmin.searchLinksPlaceholder']()}
					bind:value={tokenSearchQuery}
					class="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				/>
			</div>

			<!-- Tokens List -->
			<div class="space-y-4">
				{#if isLoadingTokens}
					<div class="flex items-center justify-center py-12">
						<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
					</div>
				{:else if tokens.length === 0}
					<div class="rounded-lg border border-dashed p-12 text-center">
						<Link class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
						<h3 class="mt-4 text-lg font-semibold">{m['eventInvitationsAdmin.noLinksFound']()}</h3>
						<p class="mt-2 text-sm text-muted-foreground">
							{#if tokenSearchQuery}
								{m['eventInvitationsAdmin.noLinksSearch']()}
							{:else}
								{m['eventInvitationsAdmin.noLinksEmpty']()}
							{/if}
						</p>
					</div>
				{:else}
					{#each tokens as token (token.id)}
						<EventTokenCard
							{token}
							orgSlug={data.event.organization.slug}
							eventSlug={data.event.slug}
							onEdit={(t) => (tokenToEdit = t)}
							onDelete={(t) => (tokenToDelete = t)}
							onShare={(t) => (tokenToShare = t)}
						/>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Create Invitation Dialog -->
<Dialog.Root open={showCreateDialog} onOpenChange={(open) => (showCreateDialog = open)}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.createInvitations']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.createDialogDescription']()}
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
			<div class="relative">
				<label class="block text-sm font-medium"
					>{m['eventInvitationsAdmin.emailAddressesLabel']()}</label
				>
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
					<div class="relative min-w-[200px] flex-1">
						<input
							type="text"
							value={emailInputValue}
							oninput={handleEmailInput}
							onkeydown={handleEmailKeydown}
							onblur={() => {
								// Delay hiding to allow clicking on suggestions
								setTimeout(() => {
									showEmailSuggestions = false;
									handleEmailBlur();
								}, 200);
							}}
							onfocus={() => {
								if (emailInputValue.trim().length >= 2 && emailSuggestions.length > 0) {
									showEmailSuggestions = true;
								}
							}}
							placeholder={emailTags.length === 0
								? m['eventInvitationsAdmin.emailPlaceholder']()
								: ''}
							class="w-full border-0 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground dark:text-gray-100"
							autocomplete="off"
							role="combobox"
							aria-expanded={showEmailSuggestions}
							aria-controls="email-suggestions"
							aria-activedescendant={selectedEmailIndex >= 0
								? `email-suggestion-${selectedEmailIndex}`
								: undefined}
						/>

						{#if showEmailSuggestions && emailSuggestions.length > 0}
							<div
								id="email-suggestions"
								role="listbox"
								class="absolute left-0 top-full z-10 mt-1 max-h-60 w-full min-w-[300px] overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
							>
								{#each emailSuggestions as suggestion, index}
									<button
										type="button"
										id="email-suggestion-{index}"
										role="option"
										aria-selected={selectedEmailIndex === index}
										onclick={() => selectEmailSuggestion(suggestion.email)}
										class="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground {selectedEmailIndex ===
										index
											? 'bg-accent text-accent-foreground'
											: ''}"
									>
										<span class="font-medium">{suggestion.name}</span>
										<span class="text-xs text-muted-foreground">{suggestion.email}</span>
									</button>
								{/each}
							</div>
						{/if}

						{#if isLoadingEmailSuggestions}
							<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
								<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
							</div>
						{/if}
					</div>
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['eventInvitationsAdmin.emailHint']()}
				</p>
			</div>

			<!-- Tier selection (only for ticketed events) -->
			{#if data.event.requires_ticket}
				<div>
					<label for="tier_id" class="block text-sm font-medium">
						{m['eventInvitationsAdmin.tierLabel']()}
					</label>
					{#if data.ticketTiers && data.ticketTiers.length > 0}
						<select
							id="tier_id"
							name="tier_id"
							bind:value={selectedTierId}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						>
							<option value="">{m['eventInvitationsAdmin.tierNone']()}</option>
							{#each data.ticketTiers as tier (tier.id)}
								<option value={tier.id}>
									{tier.name}
									{#if tier.price !== null && tier.price !== undefined && parseFloat(tier.price) !== 0}
										- {tier.currency === 'EUR' ? '€' : tier.currency}{(
											parseFloat(tier.price) / 100
										).toFixed(2)}
									{:else}
										- {m['eventInvitationsAdmin.free']()}
									{/if}
								</option>
							{/each}
						</select>
					{:else}
						<div
							class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
						>
							{m['eventInvitationsAdmin.noTiersConfigured']()}
						</div>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventInvitationsAdmin.tierHint']()}
					</p>
				</div>
			{/if}

			<!-- Custom message -->
			<div>
				<label for="custom_message" class="block text-sm font-medium">
					{m['eventInvitationsAdmin.customMessageLabel']()}
				</label>
				<textarea
					id="custom_message"
					name="custom_message"
					bind:value={invitationMessage}
					placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['eventInvitationsAdmin.charactersCount']({ count: invitationMessage.length })}
				</p>
			</div>

			<!-- Invitation properties -->
			<div class="space-y-3 rounded-lg border border-border p-4">
				<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_questionnaire"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_purchase"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_membership_required"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_rsvp_deadline"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="overrides_max_attendees"
						value="true"
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showCreateDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Mail class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.sendInvitations']()}
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
			<Dialog.Title>{m['eventInvitationsAdmin.editDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{#if editingInvitation}
					{#if editingType === 'registered' && 'user' in editingInvitation}
						{m['eventInvitationsAdmin.editDialogDescriptionUser']({
							userName: getUserDisplayName(editingInvitation.user)
						})}
					{:else if editingType === 'pending' && 'email' in editingInvitation}
						{m['eventInvitationsAdmin.editDialogDescriptionEmail']({
							email: editingInvitation.email
						})}
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
							{m['eventInvitationsAdmin.tierLabel']()}
						</label>
						{#if data.ticketTiers && data.ticketTiers.length > 0}
							<select
								id="edit_tier_id"
								name="tier_id"
								bind:value={editFormData.tier_id}
								class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							>
								<option value="">{m['eventInvitationsAdmin.tierNone']()}</option>
								{#each data.ticketTiers as tier (tier.id)}
									<option value={tier.id}>
										{tier.name}
										{#if tier.price !== null && tier.price !== undefined && parseFloat(tier.price) !== 0}
											- {tier.currency}{parseFloat(tier.price).toFixed(2)}
										{:else}
											- {m['eventInvitationsAdmin.free']()}
										{/if}
									</option>
								{/each}
							</select>
						{:else}
							<div
								class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
							>
								{m['eventInvitationsAdmin.noTiersConfigured']()}
							</div>
						{/if}
						<p class="mt-1 text-xs text-muted-foreground">
							{m['eventInvitationsAdmin.tierHint']()}
						</p>
					</div>
				{/if}

				<!-- Custom message -->
				<div>
					<label for="edit_custom_message" class="block text-sm font-medium">
						{m['eventInvitationsAdmin.customMessageLabel']()}
					</label>
					<textarea
						id="edit_custom_message"
						name="custom_message"
						bind:value={editFormData.custom_message}
						placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
						rows="3"
						maxlength="500"
						class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					></textarea>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventInvitationsAdmin.charactersCount']({
							count: editFormData.custom_message.length
						})}
					</p>
				</div>

				<!-- Invitation properties -->
				<div class="space-y-3 rounded-lg border border-border p-4">
					<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_questionnaire"
							value="true"
							bind:checked={editFormData.waives_questionnaire}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_purchase"
							value="true"
							bind:checked={editFormData.waives_purchase}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_membership_required"
							value="true"
							bind:checked={editFormData.waives_membership_required}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_rsvp_deadline"
							value="true"
							bind:checked={editFormData.waives_rsvp_deadline}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="overrides_max_attendees"
							value="true"
							bind:checked={editFormData.overrides_max_attendees}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
					</label>
				</div>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showEditDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.updateInvitation']()}
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
			<Dialog.Title>{m['eventInvitationsAdmin.bulkEditDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.bulkEditDialogDescription']({
					count: totalSelected,
					plural: totalSelected === 1 ? '' : 's'
				})}
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
						{m['eventInvitationsAdmin.tierLabel']()}
					</label>
					{#if data.ticketTiers && data.ticketTiers.length > 0}
						<select
							id="bulk_tier_id"
							name="tier_id"
							bind:value={bulkEditFormData.tier_id}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						>
							<option value="">{m['eventInvitationsAdmin.tierNone']()}</option>
							{#each data.ticketTiers as tier (tier.id)}
								<option value={tier.id}>
									{tier.name}
									{#if tier.price !== null && tier.price !== undefined && parseFloat(tier.price) !== 0}
										- {tier.currency === 'EUR' ? '€' : tier.currency}{(
											parseFloat(tier.price) / 100
										).toFixed(2)}
									{:else}
										- {m['eventInvitationsAdmin.free']()}
									{/if}
								</option>
							{/each}
						</select>
					{:else}
						<div
							class="mt-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-900"
						>
							{m['eventInvitationsAdmin.noTiersConfigured']()}
						</div>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventInvitationsAdmin.tierHint']()}
					</p>
				</div>
			{/if}

			<!-- Custom message -->
			<div>
				<label for="bulk_custom_message" class="block text-sm font-medium">
					{m['eventInvitationsAdmin.customMessageLabel']()}
				</label>
				<textarea
					id="bulk_custom_message"
					name="custom_message"
					bind:value={bulkEditFormData.custom_message}
					placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['eventInvitationsAdmin.charactersCount']({
						count: bulkEditFormData.custom_message.length
					})}
				</p>
			</div>

			<!-- Invitation properties -->
			<div class="space-y-3 rounded-lg border border-border p-4">
				<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_questionnaire"
						value="true"
						bind:checked={bulkEditFormData.waives_questionnaire}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_purchase"
						value="true"
						bind:checked={bulkEditFormData.waives_purchase}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_membership_required"
						value="true"
						bind:checked={bulkEditFormData.waives_membership_required}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_rsvp_deadline"
						value="true"
						bind:checked={bulkEditFormData.waives_rsvp_deadline}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="overrides_max_attendees"
						value="true"
						bind:checked={bulkEditFormData.overrides_max_attendees}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showBulkEditDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.updateInvitations']({
						count: totalSelected,
						plural: totalSelected === 1 ? '' : 's'
					})}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Token Modals -->
<!-- Create Token Modal -->
<EventTokenModal
	open={isCreateTokenModalOpen}
	ticketTiers={data.ticketTiers}
	isTicketedEvent={data.event.requires_ticket}
	isLoading={createTokenMutation.isPending}
	onClose={() => (isCreateTokenModalOpen = false)}
	onSave={handleCreateTokenSave}
/>

<!-- Edit Token Modal -->
<EventTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	ticketTiers={data.ticketTiers}
	isTicketedEvent={data.event.requires_ticket}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditTokenSave}
/>

<!-- Delete Token Confirmation -->
<Dialog.Root open={!!tokenToDelete}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.deleteTokenTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.deleteTokenDescription']()}
			</Dialog.Description>
		</Dialog.Header>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p>
					<strong>{m['eventInvitationsAdmin.deleteTokenLink']()}</strong>
					{tokenToDelete.name || m['eventInvitationsAdmin.deleteTokenUnnamed']()}
				</p>
				<p>
					<strong>{m['eventInvitationsAdmin.deleteTokenUses']()}</strong>
					{m['eventInvitationsAdmin.deleteTokenUsesText']({ count: tokenToDelete.uses ?? 0 })}
				</p>
				<p class="text-muted-foreground">
					{m['eventInvitationsAdmin.deleteTokenWarning']()}
				</p>
			</div>
		{/if}

		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (tokenToDelete = null)}
				disabled={deleteTokenMutation.isPending}
			>
				{m['eventInvitationsAdmin.cancel']()}
			</Button>
			<Button
				variant="destructive"
				onclick={handleDeleteToken}
				disabled={deleteTokenMutation.isPending}
			>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['eventInvitationsAdmin.deleteTokenButton']()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Share Token Dialog -->
{#if tokenToShare}
	<TokenShareDialog
		open={!!tokenToShare}
		{shareUrl}
		tokenName={tokenToShare.name || undefined}
		onClose={() => (tokenToShare = null)}
	/>
{/if}
