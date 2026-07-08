<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		eventadminrsvpsUpdateRsvp,
		eventadminrsvpsDeleteRsvp,
		organizationadminmembersListMembershipTiers,
		organizationadminmembersAddMember,
		organizationadminblacklistCreateBlacklistEntry,
		eventadminticketsExportAttendees
	} from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { Users, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import AttendeeStats from '$lib/components/attendees/AttendeeStats.svelte';
	import AttendeeFilters from '$lib/components/attendees/AttendeeFilters.svelte';
	import AttendeeTable from '$lib/components/attendees/AttendeeTable.svelte';
	import AttendeeCardList from '$lib/components/attendees/AttendeeCardList.svelte';
	import EditRsvpDialog from '$lib/components/attendees/EditRsvpDialog.svelte';
	import type { RsvpDetailSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';

	const { data }: { data: PageData } = $props();

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

	// Make member modal state
	let showMakeMemberModal = $state(false);
	let userToMakeMember = $state<{ id: string; displayName: string; email?: string } | null>(null);
	let membershipTiers = $state<MembershipTierSchema[]>([]);
	let tiersLoading = $state(false);

	// Blacklist confirmation state
	let rsvpToBlacklist = $state<RsvpDetailSchema | null>(null);
	let showBlacklistDialog = $state(false);

	// Computed: Has multiple pages
	const hasMultiplePages = $derived(!!data.nextPage || !!data.previousPage);

	// Computed: Stats (always shown)
	const stats = $derived.by(() => {
		const yesCount = data.rsvps.filter((r) => r.status === 'yes').length;
		const maybeCount = data.rsvps.filter((r) => r.status === 'maybe').length;
		const noCount = data.rsvps.filter((r) => r.status === 'no').length;

		return { yesCount, maybeCount, noCount, total: data.totalCount };
	});

	// Update RSVP mutation
	const updateRsvpMutation = createMutation(() => ({
		mutationFn: async ({ rsvpId, status }: { rsvpId: string; status: 'yes' | 'maybe' | 'no' }) => {
			const response = await eventadminrsvpsUpdateRsvp({
				path: { event_id: data.event.id, rsvp_id: rsvpId },
				body: { status },
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
			const response = await eventadminrsvpsDeleteRsvp({
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

	// Add member mutation
	const addMemberMutation = createMutation(() => ({
		mutationFn: async ({ userId, tierId }: { userId: string; tierId: string }) => {
			const response = await organizationadminmembersAddMember({
				path: { slug: organization.slug, user_id: userId },
				body: { tier_id: tierId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? String(response.error.detail)
						: m['makeMemberAction.error']();
				throw new Error(errorDetail);
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = userToMakeMember?.displayName || '';
			showMakeMemberModal = false;
			userToMakeMember = null;
			toast.success(m['makeMemberAction.success']({ name: userName }));
			invalidateAll();
		},
		onError: (error: Error) => {
			toast.error(error.message);
		}
	}));

	// Blacklist user mutation
	const blacklistMutation = createMutation(() => ({
		mutationFn: async (userId: string) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug: organization.slug },
				body: { user_id: userId, reason: '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(m['attendeesAdmin.blacklistError']());
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = rsvpToBlacklist ? getUserDisplayName(rsvpToBlacklist.user) : '';
			showBlacklistDialog = false;
			rsvpToBlacklist = null;
			toast.success(m['attendeesAdmin.blacklistSuccess']({ name: userName }));
			invalidateAll();
		},
		onError: () => {
			toast.error(m['attendeesAdmin.blacklistError']());
		}
	}));

	/**
	 * Open make member modal
	 */
	async function openMakeMemberModal(rsvp: RsvpDetailSchema) {
		const user = rsvp.user;
		if (!user?.id) {
			toast.error(m['attendeesAdmin.userIdNotAvailable']());
			return;
		}

		// Check if already a member
		if (rsvp.membership) {
			toast.info(m['makeMemberAction.alreadyMember']());
			return;
		}

		// Set user info
		userToMakeMember = {
			id: user.id,
			displayName: getUserDisplayName(user),
			email: user.email
		};

		// Load membership tiers if not already loaded
		if (membershipTiers.length === 0) {
			tiersLoading = true;
			try {
				const response = await organizationadminmembersListMembershipTiers({
					path: { slug: organization.slug },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.data) {
					membershipTiers = response.data;
				}
			} catch (err) {
				console.error('Failed to load membership tiers:', err);
			} finally {
				tiersLoading = false;
			}
		}

		showMakeMemberModal = true;
	}

	/**
	 * Handle make member confirm
	 */
	function handleMakeMemberConfirm(userId: string, tierId: string) {
		addMemberMutation.mutate({ userId, tierId });
	}

	/**
	 * Open blacklist confirmation dialog
	 */
	function openBlacklistDialog(rsvp: RsvpDetailSchema) {
		if (!rsvp.user?.id) {
			toast.error(m['attendeesAdmin.userIdNotAvailable']());
			return;
		}
		rsvpToBlacklist = rsvp;
		showBlacklistDialog = true;
	}

	/**
	 * Confirm blacklist
	 */
	function confirmBlacklist() {
		if (rsvpToBlacklist?.user?.id) {
			blacklistMutation.mutate(rsvpToBlacklist.user.id);
		}
	}

	/**
	 * Cancel blacklist
	 */
	function cancelBlacklist() {
		showBlacklistDialog = false;
		rsvpToBlacklist = null;
	}

	/**
	 * Apply filters and navigate to update URL
	 */
	function applyFilters() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams();

		if (searchQuery) params.set('search', searchQuery);
		if (activeStatusFilter) params.set('status', activeStatusFilter);

		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Handle search input with debounce
	 */
	function handleSearch(value: string) {
		// SearchInput debounces internally, so apply filters immediately.
		searchInput = value;
		searchQuery = value;
		applyFilters();
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
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams(window.location.search);
		params.set('page', page.toString());
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
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

	async function handleExportAttendees(): Promise<string> {
		const response = await eventadminticketsExportAttendees({
			path: { event_id: data.event.id },
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (response.error || !response.data?.id) {
			throw new Error('Export failed');
		}
		return response.data.id;
	}
</script>

<svelte:head>
	<title
		>{m['attendeesAdmin.headTitle']({ eventName: data.event.name })} | {organization.name} | Revel</title
	>
	<meta
		name="description"
		content={m['attendeesAdmin.headDescription']({ eventName: data.event.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<div class="mb-4">
			<a
				href={resolve('/(auth)/org/[slug]/admin/events', { slug: organization.slug })}
				class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				{m['attendeesAdmin.backToEvents']()}
			</a>
		</div>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
					{m['attendeesAdmin.pageTitle']()}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground">{data.event.name}</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
						slug: organization.slug,
						event_id: data.event.id
					})}
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['eventEditor.editEvent']()}
				</a>
				{#if data.event.waitlist_open}
					<a
						href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/waitlist', {
							slug: organization.slug,
							event_id: data.event.id
						})}
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{m['eventActionSidebar.manageWaitlist']()}
					</a>
				{/if}
				<ExportButton
					label={m['exportButton.exportAttendees']()}
					onExport={handleExportAttendees}
					{accessToken}
				/>
			</div>
		</div>
	</div>

	<!-- Stats (always shown) -->
	<AttendeeStats {stats} totalCount={data.totalCount} {hasMultiplePages} />

	<!-- Filters & Search -->
	<AttendeeFilters
		{searchInput}
		{activeStatusFilter}
		totalCount={data.totalCount}
		onSearch={handleSearch}
		onStatusFilter={filterByStatus}
	/>

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
		<AttendeeTable
			rsvps={data.rsvps}
			addMemberPending={addMemberMutation.isPending}
			{tiersLoading}
			onMakeMember={openMakeMemberModal}
			onEdit={openEditModal}
			onDelete={openDeleteDialog}
			onBlacklist={openBlacklistDialog}
		/>

		<AttendeeCardList
			rsvps={data.rsvps}
			addMemberPending={addMemberMutation.isPending}
			{tiersLoading}
			onMakeMember={openMakeMemberModal}
			onEdit={openEditModal}
			onDelete={openDeleteDialog}
			onBlacklist={openBlacklistDialog}
		/>

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
<EditRsvpDialog
	bind:open={showEditModal}
	rsvp={editingRsvp}
	bind:selectedStatus
	isPending={updateRsvpMutation.isPending}
	onSubmit={submitRsvpUpdate}
	onCancel={closeEditModal}
/>

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

<!-- Make Member Modal -->
<MakeMemberModal
	user={userToMakeMember}
	tiers={membershipTiers}
	open={showMakeMemberModal}
	onClose={() => {
		showMakeMemberModal = false;
		userToMakeMember = null;
	}}
	onConfirm={handleMakeMemberConfirm}
	isProcessing={addMemberMutation.isPending}
/>

<!-- Blacklist Confirmation Dialog -->
<ConfirmDialog
	isOpen={showBlacklistDialog}
	title={m['attendeesAdmin.blacklistDialogTitle']()}
	message={rsvpToBlacklist
		? m['attendeesAdmin.blacklistDialogMessage']({
				name: getUserDisplayName(rsvpToBlacklist.user)
			})
		: ''}
	confirmText={m['attendeesAdmin.blacklistDialogConfirm']()}
	cancelText={m['attendeesAdmin.blacklistDialogCancel']()}
	variant="danger"
	onConfirm={confirmBlacklist}
	onCancel={cancelBlacklist}
/>
