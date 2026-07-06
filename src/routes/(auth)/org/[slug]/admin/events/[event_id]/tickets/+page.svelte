<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { fade, scale } from 'svelte/transition';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import {
		needsPaymentConfirmation,
		isPwycTicket,
		getPwycWarning
	} from '$lib/utils/ticket-helpers';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Ticket, AlertTriangle, QrCode, X } from '@lucide/svelte';
	import {
		eventadminticketsConfirmTicketPayment,
		eventadminticketsUnconfirmTicketPayment,
		eventadminticketsCancelTicket,
		eventadminticketsCheckInTicket,
		eventadminticketsGetTicket,
		organizationadminmembersListMembershipTiers,
		organizationadminmembersAddMember,
		organizationadminblacklistCreateBlacklistEntry,
		eventadminticketsExportAttendees
	} from '$lib/api';
	import type { ComponentProps } from 'svelte';
	import type { PageData } from './$types';
	import type { AdminTicketSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
	import TicketFilters from '$lib/components/tickets/TicketFilters.svelte';
	import TicketTable from '$lib/components/tickets/TicketTable.svelte';
	import TicketCardList from '$lib/components/tickets/TicketCardList.svelte';
	import TicketStats from '$lib/components/tickets/TicketStats.svelte';
	import {
		nextOrderBy,
		type TicketOrderBy,
		type TicketSortField
	} from '$lib/components/tickets/ticket-sort';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';

	const { data }: { data: PageData } = $props();

	// Search state
	let searchQuery = $state(data.filters.search || '');

	// Filter states
	let selectedStatus = $state<string | null>(data.filters.status || null);
	let selectedPaymentMethod = $state<string | null>(data.filters.paymentMethod || null);

	// Sort state (server-side, persisted in the URL)
	let selectedOrderBy = $state<TicketOrderBy | undefined>(data.filters.orderBy ?? undefined);

	// CheckInDialog declares a stricter ticket shape than the generated
	// AdminTicketSchema (non-nullable id/status, no nulls on user name fields),
	// so store the adapted shape for it.
	type CheckInDialogTicket = NonNullable<ComponentProps<typeof CheckInDialog>['ticket']>;

	// Confirmation dialogs
	let showCancelDialog = $state(false);
	let ticketToCancel = $state<AdminTicketSchema | null>(null);
	let showConfirmPaymentDialog = $state(false);
	let ticketToConfirm = $state<AdminTicketSchema | null>(null);
	let showCheckInDialog = $state(false);
	let ticketToCheckIn = $state<CheckInDialogTicket | null>(null);
	let showQRScanner = $state(false);

	// Make member modal state
	let showMakeMemberModal = $state(false);
	let userToMakeMember = $state<{ id: string; displayName: string; email?: string } | null>(null);
	let membershipTiers = $state<MembershipTierSchema[]>([]);
	let tiersLoading = $state(false);

	// Blacklist confirmation state
	let showBlacklistDialog = $state(false);
	let ticketToBlacklist = $state<AdminTicketSchema | null>(null);

	// Unconfirm payment confirmation state
	let showUnconfirmPaymentDialog = $state(false);
	let ticketToUnconfirm = $state<AdminTicketSchema | null>(null);

	/**
	 * Adapt an AdminTicketSchema to CheckInDialog's stricter ticket shape.
	 * Only normalizes generator-nullable fields (null -> undefined / ''); the
	 * data itself is unchanged.
	 */
	function toCheckInTicket(ticket: AdminTicketSchema): CheckInDialogTicket {
		return {
			...ticket,
			id: ticket.id ?? '',
			status: ticket.status ?? '',
			user: {
				...ticket.user,
				email: ticket.user.email ?? undefined,
				preferred_name: ticket.user.preferred_name ?? undefined,
				first_name: ticket.user.first_name ?? undefined,
				last_name: ticket.user.last_name ?? undefined
			},
			seat: ticket.seat ?? undefined
		};
	}

	// PWYC confirm payment state
	let pwycPricePaid = $state('');

	/**
	 * Derived: Check if there are multiple pages
	 */
	const hasMultiplePages = $derived(!!(data.nextPage || data.previousPage));

	/**
	 * Derived: Calculate stats from current page tickets
	 */
	const stats = $derived.by(() => {
		const total = data.tickets.length;
		const pending = data.tickets.filter((t) => t.status === 'pending').length;
		const active = data.tickets.filter((t) => t.status === 'active').length;
		const checkedIn = data.tickets.filter((t) => t.status === 'checked_in').length;
		const cancelled = data.tickets.filter((t) => t.status === 'cancelled').length;

		return { total, pending, active, checkedIn, cancelled };
	});

	/**
	 * Confirm payment mutation
	 */
	const confirmPaymentMutation = createMutation(() => ({
		mutationFn: async ({ ticketId, pricePaid }: { ticketId: string; pricePaid?: string }) => {
			const response = await eventadminticketsConfirmTicketPayment({
				path: { event_id: data.event.id, ticket_id: ticketId },
				body: pricePaid ? { price_paid: pricePaid } : undefined,
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to confirm payment');
			}

			return response.data;
		},
		onSuccess: () => {
			showConfirmPaymentDialog = false;
			ticketToConfirm = null;
			pwycPricePaid = '';
			invalidateAll();
		}
	}));

	/**
	 * Unconfirm payment mutation
	 */
	const unconfirmPaymentMutation = createMutation(() => ({
		mutationFn: async (ticketId: string) => {
			const response = await eventadminticketsUnconfirmTicketPayment({
				path: { event_id: data.event.id, ticket_id: ticketId },
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to unconfirm payment');
			}

			return response.data;
		},
		onSuccess: () => {
			showUnconfirmPaymentDialog = false;
			ticketToUnconfirm = null;
			toast.success(m['eventTicketsAdmin.unconfirmPaymentSuccess']());
			invalidateAll();
		},
		onError: () => {
			toast.error(m['eventTicketsAdmin.unconfirmPaymentError']());
		}
	}));

	/**
	 * Cancel ticket mutation
	 */
	const cancelTicketMutation = createMutation(() => ({
		mutationFn: async (ticketId: string) => {
			const response = await eventadminticketsCancelTicket({
				path: { event_id: data.event.id, ticket_id: ticketId },
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to cancel ticket');
			}

			return response.data;
		},
		onSuccess: () => {
			showCancelDialog = false;
			ticketToCancel = null;
			invalidateAll();
		}
	}));

	/**
	 * Check-in ticket mutation
	 */
	const checkInTicketMutation = createMutation(() => ({
		mutationFn: async ({ ticketId, pricePaid }: { ticketId: string; pricePaid?: string }) => {
			const response = await eventadminticketsCheckInTicket({
				path: { event_id: data.event.id, ticket_id: ticketId },
				body: pricePaid ? { price_paid: pricePaid } : undefined,
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? String(response.error.detail)
						: 'Failed to check in ticket';
				throw new Error(errorDetail);
			}

			return response.data;
		},
		onSuccess: () => {
			showCheckInDialog = false;
			ticketToCheckIn = null;
			invalidateAll();
		}
	}));

	/**
	 * Add member mutation
	 */
	const addMemberMutation = createMutation(() => ({
		mutationFn: async ({ userId, tierId }: { userId: string; tierId: string }) => {
			const response = await organizationadminmembersAddMember({
				path: { slug: data.event.organization.slug, user_id: userId },
				body: { tier_id: tierId },
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
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

	/**
	 * Blacklist user mutation
	 */
	const blacklistMutation = createMutation(() => ({
		mutationFn: async (userId: string) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug: data.event.organization.slug },
				body: { user_id: userId, reason: '' },
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				throw new Error(m['eventTicketsAdmin.blacklistError']());
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = ticketToBlacklist ? getUserDisplayName(ticketToBlacklist.user) : '';
			showBlacklistDialog = false;
			ticketToBlacklist = null;
			toast.success(m['eventTicketsAdmin.blacklistSuccess']({ name: userName }));
			invalidateAll();
		},
		onError: () => {
			toast.error(m['eventTicketsAdmin.blacklistError']());
		}
	}));

	/**
	 * Open make member modal
	 */
	async function openMakeMemberModal(ticket: AdminTicketSchema) {
		const user = ticket.user;
		if (!user?.id) {
			toast.error(m['eventTicketsAdmin.userIdNotAvailable']());
			return;
		}

		// Check if already a member
		if (ticket.membership) {
			toast.info(m['makeMemberAction.alreadyMember']());
			return;
		}

		// Set user info
		userToMakeMember = {
			id: user.id,
			displayName: getUserDisplayName(user),
			email: user.email ?? undefined
		};

		// Load membership tiers if not already loaded
		if (membershipTiers.length === 0) {
			tiersLoading = true;
			try {
				const response = await organizationadminmembersListMembershipTiers({
					path: { slug: data.event.organization.slug },
					headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
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
	 * Open blacklist dialog
	 */
	function openBlacklistDialog(ticket: AdminTicketSchema) {
		if (!ticket.user?.id) {
			toast.error(m['eventTicketsAdmin.userIdNotAvailable']());
			return;
		}
		ticketToBlacklist = ticket;
		showBlacklistDialog = true;
	}

	/**
	 * Confirm blacklist
	 */
	function confirmBlacklist() {
		if (ticketToBlacklist?.user?.id) {
			blacklistMutation.mutate(ticketToBlacklist.user.id);
		}
	}

	/**
	 * Cancel blacklist
	 */
	function cancelBlacklist() {
		showBlacklistDialog = false;
		ticketToBlacklist = null;
	}

	/**
	 * Open unconfirm payment dialog
	 */
	function openUnconfirmPaymentDialog(ticket: AdminTicketSchema) {
		ticketToUnconfirm = ticket;
		showUnconfirmPaymentDialog = true;
	}

	/**
	 * Confirm unconfirm payment
	 */
	function confirmUnconfirmPayment() {
		if (ticketToUnconfirm?.id) {
			unconfirmPaymentMutation.mutate(ticketToUnconfirm.id);
		}
	}

	/**
	 * Cancel unconfirm payment
	 */
	function cancelUnconfirmPayment() {
		showUnconfirmPaymentDialog = false;
		ticketToUnconfirm = null;
	}

	/**
	 * Handle search input
	 */
	function handleSearch(value: string) {
		searchQuery = value;
		// SearchInput debounces internally, so apply filters immediately.
		applyFilters();
	}

	/**
	 * Apply filters to URL
	 */
	function applyFilters() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (selectedStatus) params.set('status', selectedStatus);
		if (selectedPaymentMethod) params.set('payment_method', selectedPaymentMethod);
		if (selectedOrderBy) params.set('order_by', selectedOrderBy);
		// Reset to page 1 when filters change
		params.set('page', '1');

		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Set the sort order directly (used by the mobile sort select).
	 */
	function setOrderBy(orderBy: TicketOrderBy | undefined) {
		selectedOrderBy = orderBy;
		applyFilters();
	}

	/**
	 * Toggle sort on a column header (asc ↔ desc).
	 */
	function handleSort(field: TicketSortField) {
		selectedOrderBy = nextOrderBy(selectedOrderBy, field);
		applyFilters();
	}

	/**
	 * Set status filter
	 */
	function setStatusFilter(status: string | null) {
		selectedStatus = status;
		applyFilters();
	}

	/**
	 * Set payment method filter
	 */
	function setPaymentMethodFilter(method: string | null) {
		selectedPaymentMethod = method;
		applyFilters();
	}

	/**
	 * Navigate to page
	 */
	function goToPage(pageNum: number) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Handle confirm payment
	 */
	function handleConfirmPayment(ticket: AdminTicketSchema) {
		ticketToConfirm = ticket;
		// Pre-fill with pwyc_min for PWYC tiers
		if (isPwycTicket(ticket)) {
			pwycPricePaid = ticket.price_paid || ticket.tier?.pwyc_min || '';
		} else {
			pwycPricePaid = '';
		}
		showConfirmPaymentDialog = true;
	}

	/**
	 * Submit confirm payment
	 */
	function submitConfirmPayment() {
		if (ticketToConfirm?.id) {
			const pricePaid = isPwycTicket(ticketToConfirm) ? pwycPricePaid : undefined;
			confirmPaymentMutation.mutate({ ticketId: ticketToConfirm.id, pricePaid });
		}
	}

	/**
	 * Handle cancel ticket
	 */
	function handleCancelTicket(ticket: AdminTicketSchema) {
		ticketToCancel = ticket;
		showCancelDialog = true;
	}

	/**
	 * Submit cancel ticket
	 */
	function submitCancelTicket() {
		if (ticketToCancel?.id) {
			cancelTicketMutation.mutate(ticketToCancel.id);
		}
	}

	/**
	 * Handle manual check-in
	 */
	function handleCheckIn(ticket: AdminTicketSchema) {
		ticketToCheckIn = toCheckInTicket(ticket);
		showCheckInDialog = true;
	}

	/**
	 * Submit check-in
	 */
	function submitCheckIn(pricePaid?: string) {
		if (ticketToCheckIn) {
			checkInTicketMutation.mutate({ ticketId: ticketToCheckIn.id, pricePaid });
		}
	}

	/**
	 * Handle QR code scan
	 */
	async function handleQRScan(ticketId: string) {
		try {
			// Fetch ticket details
			const response = await eventadminticketsGetTicket({
				path: { event_id: data.event.id, ticket_id: ticketId },
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error || !response.data) {
				throw new Error('Ticket not found');
			}

			// Show confirmation dialog with ticket info
			ticketToCheckIn = toCheckInTicket(response.data);
			showCheckInDialog = true;
			showQRScanner = false;
		} catch (err) {
			console.error('Failed to fetch ticket:', err);
			// Error will be shown in the scanner component
		}
	}

	async function handleExportAttendees(): Promise<string> {
		const response = await eventadminticketsExportAttendees({
			path: { event_id: data.event.id },
			headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
		});
		if (response.error || !response.data?.id) {
			throw new Error('Export failed');
		}
		return response.data.id;
	}
</script>

<svelte:head>
	<title>{m['eventTicketsAdmin.pageTitle']()} - {data.event.name} | Revel</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<!-- Header -->
	<div class="mb-6">
		<div class="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
			<a href="/org/{data.event.organization.slug}/admin" class="hover:underline"
				>{m['eventTicketsAdmin.breadcrumbDashboard']()}</a
			>
			<span>/</span>
			<a href="/org/{data.event.organization.slug}/admin/events" class="hover:underline"
				>{m['eventTicketsAdmin.breadcrumbEvents']()}</a
			>
			<span>/</span>
			<span>{data.event.name}</span>
		</div>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-3xl font-bold">{m['eventTicketsAdmin.pageTitle']()}</h1>
				<p class="mt-2 text-muted-foreground">{m['eventTicketsAdmin.pageDescription']()}</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<a
					href="/org/{data.event.organization.slug}/admin/events/{data.event.id}/edit"
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['eventEditor.editEvent']()}
				</a>
				<a
					href="/org/{data.event.organization.slug}/admin/events/{data.event.id}/edit?tab=ticketing"
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['eventEditor.ticketing']()}
				</a>
				{#if data.event.waitlist_open}
					<a
						href="/org/{data.event.organization.slug}/admin/events/{data.event.id}/waitlist"
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{m['eventActionSidebar.manageWaitlist']()}
					</a>
				{/if}
				<ExportButton
					label={m['exportButton.exportAttendees']()}
					onExport={handleExportAttendees}
					accessToken={$page.data.user?.accessToken ?? null}
				/>
			</div>
		</div>
	</div>

	<!-- Check-in Button (QR Scanner) -->
	<div class="mb-6">
		<Button
			variant="default"
			class="inline-flex items-center gap-2"
			onclick={() => (showQRScanner = true)}
		>
			<QrCode class="h-4 w-4" aria-hidden="true" />
			{m['eventTicketsAdmin.scanQRButton']()}
		</Button>
		<p class="mt-2 text-sm text-muted-foreground">
			{m['eventTicketsAdmin.scanQRDescription']()}
		</p>
	</div>

	<!-- Stats (always shown) -->
	<TicketStats {stats} totalCount={data.totalCount} {hasMultiplePages} revenue={data.revenue} />

	<!-- Search and Filters -->
	<TicketFilters
		{searchQuery}
		{selectedStatus}
		{selectedPaymentMethod}
		{selectedOrderBy}
		onSearch={handleSearch}
		onStatusFilter={setStatusFilter}
		onPaymentMethodFilter={setPaymentMethodFilter}
		onSort={setOrderBy}
	/>

	<!-- Tickets List -->
	<div class="mt-6">
		{#if data.tickets.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
			>
				<Ticket class="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<h3 class="mb-2 text-lg font-semibold">{m['eventTicketsAdmin.noTicketsFiltered']()}</h3>
				<p class="text-sm text-muted-foreground">
					{#if searchQuery || selectedStatus || selectedPaymentMethod}
						{m['eventTicketsAdmin.noTicketsFiltered']()}
					{:else}
						{m['eventTicketsAdmin.noTicketsEmpty']()}
					{/if}
				</p>
			</div>
		{:else}
			<!-- Desktop Table -->
			<TicketTable
				tickets={data.tickets}
				orderBy={selectedOrderBy}
				onSort={handleSort}
				checkInPending={checkInTicketMutation.isPending}
				confirmPaymentPending={confirmPaymentMutation.isPending}
				cancelTicketPending={cancelTicketMutation.isPending}
				addMemberPending={addMemberMutation.isPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				{tiersLoading}
				onCheckIn={handleCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={openMakeMemberModal}
				onCancelTicket={handleCancelTicket}
				onBlacklist={openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
			/>

			<!-- Mobile Cards -->
			<TicketCardList
				tickets={data.tickets}
				checkInPending={checkInTicketMutation.isPending}
				confirmPaymentPending={confirmPaymentMutation.isPending}
				cancelTicketPending={cancelTicketMutation.isPending}
				addMemberPending={addMemberMutation.isPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				{tiersLoading}
				onCheckIn={handleCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={openMakeMemberModal}
				onCancelTicket={handleCancelTicket}
				onBlacklist={openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
			/>
		{/if}

		<!-- Pagination -->
		{#if data.tickets.length > 0}
			<div class="mt-6 flex items-center justify-between">
				<div class="text-sm text-muted-foreground">
					{m['eventTicketsAdmin.paginationShowing']({
						page: data.currentPage,
						totalPages: Math.ceil(data.totalCount / data.pageSize),
						total: data.totalCount
					})}
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => goToPage(data.currentPage - 1)}
						disabled={!data.previousPage}
					>
						{m['eventTicketsAdmin.paginationPrevious']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => goToPage(data.currentPage + 1)}
						disabled={!data.nextPage}
					>
						{m['eventTicketsAdmin.paginationNext']()}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Confirm Payment Dialog -->
{#if showConfirmPaymentDialog && ticketToConfirm}
	{@const pwyc = isPwycTicket(ticketToConfirm)}
	{@const pwycWarning = pwyc ? getPwycWarning(ticketToConfirm, pwycPricePaid) : null}
	{@const pwycValid = !pwyc || (pwycPricePaid !== '' && parseFloat(pwycPricePaid) > 0)}
	<div
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showConfirmPaymentDialog = false;
				ticketToConfirm = null;
				pwycPricePaid = '';
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				showConfirmPaymentDialog = false;
				ticketToConfirm = null;
				pwycPricePaid = '';
			}
		}}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-payment-dialog-title"
			class="relative mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={() => {
					showConfirmPaymentDialog = false;
					ticketToConfirm = null;
					pwycPricePaid = '';
				}}
				aria-label={m['eventTicketsAdmin.closeDialog']()}
				class="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>

			<!-- Icon + Title -->
			<div class="flex items-start gap-4">
				<div
					class="shrink-0 rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
					aria-hidden="true"
				>
					<AlertTriangle class="h-6 w-6" />
				</div>
				<div class="flex-1 pt-1">
					<h2 id="confirm-payment-dialog-title" class="text-lg font-semibold text-foreground">
						{m['eventTicketsAdmin.confirmPaymentTitle']()}
					</h2>
				</div>
			</div>

			<!-- Message -->
			<div class="mt-4 text-sm text-muted-foreground">
				{ticketToConfirm.status === 'cancelled'
					? m['eventTicketsAdmin.confirmPaymentMessageReactivate']()
					: m['eventTicketsAdmin.confirmPaymentMessageActivate']()}
			</div>

			<!-- PWYC Price Input -->
			{#if pwyc}
				<div class="mt-4 space-y-2">
					<label for="pwyc-price-input" class="block text-sm font-medium text-foreground">
						{m['eventTicketsAdmin.amountPaidLabel']({
							currency: ticketToConfirm.tier?.currency?.toUpperCase() || 'EUR'
						})}
					</label>
					<Input
						id="pwyc-price-input"
						type="text"
						inputmode="decimal"
						value={pwycPricePaid}
						oninput={(e) => {
							pwycPricePaid = (e.currentTarget as HTMLInputElement).value
								.replace(/,/g, '.')
								.replace(/[^\d.]/g, '');
						}}
						placeholder={ticketToConfirm.tier?.pwyc_min || '0.00'}
						aria-describedby={pwycWarning ? 'pwyc-warning' : undefined}
					/>
					{#if pwycWarning}
						<p id="pwyc-warning" class="text-sm text-orange-600 dark:text-orange-400">
							{pwycWarning}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={() => {
						showConfirmPaymentDialog = false;
						ticketToConfirm = null;
						pwycPricePaid = '';
					}}
					class="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['eventTicketsAdmin.confirmPaymentCancel']()}
				</button>
				<button
					type="button"
					onclick={submitConfirmPayment}
					disabled={confirmPaymentMutation.isPending || !pwycValid}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				>
					{#if confirmPaymentMutation.isPending}
						{m['eventTicketsAdmin.confirmingPayment']()}
					{:else}
						{m['eventTicketsAdmin.confirmPaymentButton']()}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Cancel Confirmation Dialog -->
<ConfirmDialog
	isOpen={showCancelDialog}
	title={m['eventTicketsAdmin.cancelTicketTitle']()}
	message={m['eventTicketsAdmin.cancelTicketMessage']()}
	confirmText={m['eventTicketsAdmin.cancelTicketButton']()}
	cancelText={m['eventTicketsAdmin.cancelTicketKeep']()}
	onConfirm={submitCancelTicket}
	onCancel={() => {
		showCancelDialog = false;
		ticketToCancel = null;
	}}
	variant="danger"
/>

<!-- Check-in Confirmation Dialog -->
<CheckInDialog
	isOpen={showCheckInDialog}
	ticket={ticketToCheckIn}
	needsPaymentConfirmation={ticketToCheckIn ? needsPaymentConfirmation(ticketToCheckIn) : false}
	onConfirm={submitCheckIn}
	onCancel={() => {
		showCheckInDialog = false;
		ticketToCheckIn = null;
	}}
	isLoading={checkInTicketMutation.isPending}
/>

<!-- QR Scanner Modal -->
<QRScannerModal
	isOpen={showQRScanner}
	onClose={() => (showQRScanner = false)}
	onScan={handleQRScan}
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
	title={m['eventTicketsAdmin.blacklistDialogTitle']()}
	message={ticketToBlacklist
		? m['eventTicketsAdmin.blacklistDialogMessage']({
				name: getUserDisplayName(ticketToBlacklist.user)
			})
		: ''}
	confirmText={m['eventTicketsAdmin.blacklistDialogConfirm']()}
	cancelText={m['eventTicketsAdmin.blacklistDialogCancel']()}
	onConfirm={confirmBlacklist}
	onCancel={cancelBlacklist}
	variant="danger"
/>

<!-- Unconfirm Payment Confirmation Dialog -->
<ConfirmDialog
	isOpen={showUnconfirmPaymentDialog}
	title={m['eventTicketsAdmin.unconfirmPaymentTitle']()}
	message={m['eventTicketsAdmin.unconfirmPaymentMessage']()}
	confirmText={m['eventTicketsAdmin.unconfirmPaymentConfirm']()}
	cancelText={m['confirmDialog.cancel']()}
	onConfirm={confirmUnconfirmPayment}
	onCancel={cancelUnconfirmPayment}
	variant="warning"
/>
