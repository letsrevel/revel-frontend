<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { needsPaymentConfirmation, isPwycTicket } from '$lib/utils/ticket-helpers';
	import { Button } from '$lib/components/ui/button';
	import { Ticket, QrCode } from '@lucide/svelte';
	import {
		eventadminticketsConfirmTicketPayment,
		eventadminticketsUnconfirmTicketPayment,
		eventadminticketsExportAttendees
	} from '$lib/api';
	import type { PageData } from './$types';
	import type { AdminTicketSchema } from '$lib/api/generated/types.gen';
	import TicketFilters from '$lib/components/tickets/TicketFilters.svelte';
	import TicketTable from '$lib/components/tickets/TicketTable.svelte';
	import TicketCardList from '$lib/components/tickets/TicketCardList.svelte';
	import TicketStats from '$lib/components/tickets/TicketStats.svelte';
	import ConfirmPaymentDialog from '$lib/components/tickets/ConfirmPaymentDialog.svelte';
	import {
		nextOrderBy,
		type TicketOrderBy,
		type TicketSortField
	} from '$lib/components/tickets/ticket-sort';
	import { createTicketMemberAdmin } from '$lib/components/tickets/ticket-member-admin.svelte';
	import { createTicketCancelRefundAdmin } from '$lib/components/tickets/ticket-cancel-refund-admin.svelte';
	import { createTicketScanCheckIn } from '$lib/components/tickets/ticket-scan-checkin.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';
	import ReseatDialog from '$lib/components/tickets/ReseatDialog.svelte';
	import RenameTicketHolderDialog from '$lib/components/tickets/RenameTicketHolderDialog.svelte';
	import RefundTicketDialog from '$lib/components/tickets/RefundTicketDialog.svelte';
	import AdminCancelTicketDialog from '$lib/components/tickets/AdminCancelTicketDialog.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import MemberScanResultDialog from '$lib/components/members/MemberScanResultDialog.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	const { data }: { data: PageData } = $props();

	// Search state
	let searchQuery = $state(data.filters.search || '');

	// Filter states
	let selectedStatus = $state<string | null>(data.filters.status || null);
	let selectedPaymentMethod = $state<string | null>(data.filters.paymentMethod || null);
	let selectedSource = $state<string | null>(data.filters.source || null);

	// Sort state (server-side, persisted in the URL)
	let selectedOrderBy = $state<TicketOrderBy | undefined>(data.filters.orderBy ?? undefined);

	// Confirmation dialogs
	let showConfirmPaymentDialog = $state(false);
	let ticketToConfirm = $state<AdminTicketSchema | null>(null);
	let showReseatDialog = $state(false);
	let ticketToReseat = $state<AdminTicketSchema | null>(null);
	let showRenameDialog = $state(false);
	let ticketToRename = $state<AdminTicketSchema | null>(null);

	// Membership + blacklist admin actions (state, mutations, handlers).
	const memberAdmin = createTicketMemberAdmin({
		getSlug: () => data.event.organization.slug,
		getAccessToken: () => authStore.accessToken
	});

	// Scan → check-in flow: the QR scanner, the confirm dialog, and the
	// membership-card report (`member:` codes, FE #845). Lives outside this file
	// because the route is a dozen lines under the 750-line cap.
	const scanCheckIn = createTicketScanCheckIn({
		getEventId: () => data.event.id,
		getAccessToken: () => authStore.accessToken
	});

	// Cancel + refund admin actions (organizer refunds, FE #831): routes
	// online tickets to the refund-aware cancel dialog, keeps the plain
	// confirm for the rest, and owns the refund-payment dialog state.
	const cancelRefund = createTicketCancelRefundAdmin({
		getEventId: () => data.event.id,
		getAccessToken: () => authStore.accessToken
	});

	// Unconfirm payment confirmation state
	let showUnconfirmPaymentDialog = $state(false);
	let ticketToUnconfirm = $state<AdminTicketSchema | null>(null);

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
				headers: { Authorization: `Bearer ${authStore.accessToken}` }
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
				headers: { Authorization: `Bearer ${authStore.accessToken}` }
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

	// Open unconfirm payment dialog
	function openUnconfirmPaymentDialog(ticket: AdminTicketSchema) {
		ticketToUnconfirm = ticket;
		showUnconfirmPaymentDialog = true;
	}

	// Confirm unconfirm payment
	function confirmUnconfirmPayment() {
		if (ticketToUnconfirm?.id) {
			unconfirmPaymentMutation.mutate(ticketToUnconfirm.id);
		}
	}

	// Cancel unconfirm payment
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

	// Apply filters to URL
	function applyFilters() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (selectedStatus) params.set('status', selectedStatus);
		if (selectedPaymentMethod) params.set('payment_method', selectedPaymentMethod);
		if (selectedSource) params.set('source', selectedSource);
		if (selectedOrderBy) params.set('order_by', selectedOrderBy);
		// Reset to page 1 when filters change
		params.set('page', '1');

		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
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
	 * Set ticket source filter (direct purchase vs. series pass)
	 */
	function setSourceFilter(source: string | null) {
		selectedSource = source;
		applyFilters();
	}

	// Navigate to page
	function goToPage(pageNum: number) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
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

	// Close confirm payment dialog
	function closeConfirmPaymentDialog() {
		showConfirmPaymentDialog = false;
		ticketToConfirm = null;
		pwycPricePaid = '';
	}

	// Submit confirm payment
	function submitConfirmPayment() {
		if (ticketToConfirm?.id) {
			const pricePaid = isPwycTicket(ticketToConfirm) ? pwycPricePaid : undefined;
			confirmPaymentMutation.mutate({ ticketId: ticketToConfirm.id, pricePaid });
		}
	}

	/**
	 * Open the reseat dialog for a seated ticket.
	 */
	function handleReseat(ticket: AdminTicketSchema) {
		ticketToReseat = ticket;
		showReseatDialog = true;
	}

	// Open the rename-holder dialog for a ticket.
	function handleRenameHolder(ticket: AdminTicketSchema) {
		ticketToRename = ticket;
		showRenameDialog = true;
	}

	async function handleExportAttendees(): Promise<string> {
		const response = await eventadminticketsExportAttendees({
			path: { event_id: data.event.id },
			headers: { Authorization: `Bearer ${authStore.accessToken}` }
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
			<a
				href={resolve('/(auth)/org/[slug]/admin', { slug: data.event.organization.slug })}
				class="hover:underline">{m['eventTicketsAdmin.breadcrumbDashboard']()}</a
			>
			<span>/</span>
			<a
				href={resolve('/(auth)/org/[slug]/admin/events', { slug: data.event.organization.slug })}
				class="hover:underline">{m['eventTicketsAdmin.breadcrumbEvents']()}</a
			>
			<span>/</span>
			<span>{data.event.name}</span>
		</div>
		{#snippet ticketsHeaderActions()}
			<a
				href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
					slug: data.event.organization.slug,
					event_id: data.event.id
				})}
				class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{m['eventEditor.editEvent']()}
			</a>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
			<a
				href={`${resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', { slug: data.event.organization.slug, event_id: data.event.id })}?tab=ticketing`}
				class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{m['eventEditor.ticketing']()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{#if data.event.waitlist_open}
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/waitlist', {
						slug: data.event.organization.slug,
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
				accessToken={authStore.accessToken}
			/>
		{/snippet}
		<PageHeader
			title={m['eventTicketsAdmin.pageTitle']()}
			subtitle={m['eventTicketsAdmin.pageDescription']()}
			actions={ticketsHeaderActions}
		/>
	</div>

	<!-- Check-in Button (QR Scanner) -->
	<div class="mb-6">
		<Button
			variant="default"
			class="inline-flex items-center gap-2"
			onclick={() => (scanCheckIn.showQRScanner = true)}
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
		{selectedSource}
		{selectedOrderBy}
		onSearch={handleSearch}
		onStatusFilter={setStatusFilter}
		onPaymentMethodFilter={setPaymentMethodFilter}
		onSourceFilter={setSourceFilter}
		onSort={setOrderBy}
	/>

	<!-- Tickets List -->
	<div class="mt-6">
		{#if data.tickets.length === 0}
			<EmptyState
				icon={Ticket}
				title={m['eventTicketsAdmin.noTicketsFiltered']()}
				body={searchQuery || selectedStatus || selectedPaymentMethod || selectedSource
					? m['eventTicketsAdmin.noTicketsFiltered']()
					: m['eventTicketsAdmin.noTicketsEmpty']()}
			/>
		{:else}
			<!-- Desktop Table -->
			<TicketTable
				tickets={data.tickets}
				orderBy={selectedOrderBy}
				onSort={handleSort}
				checkInPending={scanCheckIn.checkInPending}
				confirmPaymentPending={confirmPaymentMutation.isPending}
				cancelTicketPending={cancelRefund.cancelTicketPending}
				addMemberPending={memberAdmin.addMemberPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				tiersLoading={memberAdmin.tiersLoading}
				onCheckIn={scanCheckIn.openCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={memberAdmin.openMakeMemberModal}
				onCancelTicket={cancelRefund.openCancel}
				onBlacklist={memberAdmin.openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
				onReseat={handleReseat}
				onRenameHolder={handleRenameHolder}
				onRefundTicket={cancelRefund.openRefund}
			/>

			<!-- Mobile Cards -->
			<TicketCardList
				tickets={data.tickets}
				checkInPending={scanCheckIn.checkInPending}
				confirmPaymentPending={confirmPaymentMutation.isPending}
				cancelTicketPending={cancelRefund.cancelTicketPending}
				addMemberPending={memberAdmin.addMemberPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				tiersLoading={memberAdmin.tiersLoading}
				onCheckIn={scanCheckIn.openCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={memberAdmin.openMakeMemberModal}
				onCancelTicket={cancelRefund.openCancel}
				onBlacklist={memberAdmin.openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
				onReseat={handleReseat}
				onRenameHolder={handleRenameHolder}
				onRefundTicket={cancelRefund.openRefund}
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
<ConfirmPaymentDialog
	isOpen={showConfirmPaymentDialog}
	ticket={ticketToConfirm}
	bind:pwycPricePaid
	isPending={confirmPaymentMutation.isPending}
	onConfirm={submitConfirmPayment}
	onClose={closeConfirmPaymentDialog}
/>

<!-- Cancel Confirmation Dialog (offline/at-the-door/free) -->
<ConfirmDialog
	isOpen={cancelRefund.showCancelDialog}
	title={m['eventTicketsAdmin.cancelTicketTitle']()}
	message={m['eventTicketsAdmin.cancelTicketMessage']()}
	confirmText={m['eventTicketsAdmin.cancelTicketButton']()}
	cancelText={m['eventTicketsAdmin.cancelTicketKeep']()}
	onConfirm={cancelRefund.submitCancel}
	onCancel={cancelRefund.closeCancel}
	variant="danger"
/>

<!-- Check-in Confirmation Dialog -->
<CheckInDialog
	isOpen={scanCheckIn.showCheckInDialog}
	ticket={scanCheckIn.ticketToCheckIn}
	needsPaymentConfirmation={scanCheckIn.ticketToCheckIn
		? needsPaymentConfirmation(scanCheckIn.ticketToCheckIn)
		: false}
	onConfirm={scanCheckIn.submitCheckIn}
	onCancel={scanCheckIn.closeCheckIn}
	isLoading={scanCheckIn.checkInPending}
	errorMessage={scanCheckIn.checkInDialogError}
/>

<!-- Membership card scanned: a REPORT, not a check-in. Opens only when the
     backend burned nothing — the exactly-one-ticket case returns a normal
     check-in result and never reaches here. -->
<MemberScanResultDialog
	report={scanCheckIn.memberReport}
	pendingTicketId={scanCheckIn.pendingMemberTicketId}
	onCheckInTicket={scanCheckIn.checkInMemberTicket}
	onClose={scanCheckIn.closeMemberReport}
/>

<!-- QR Scanner Modal -->
<QRScannerModal
	isOpen={scanCheckIn.showQRScanner}
	onClose={() => (scanCheckIn.showQRScanner = false)}
	onScan={scanCheckIn.handleQRScan}
/>

<!-- Reseat (move seat) Dialog -->
<ReseatDialog
	open={showReseatDialog}
	ticket={ticketToReseat}
	eventId={data.event.id}
	accessToken={authStore.accessToken}
	onClose={() => {
		showReseatDialog = false;
		ticketToReseat = null;
	}}
	onReseated={() => invalidateAll()}
/>

<!-- Rename holder Dialog -->
{#if ticketToRename?.id}
	<RenameTicketHolderDialog
		open={showRenameDialog}
		ticketId={ticketToRename.id}
		eventId={data.event.id}
		currentName={ticketToRename.guest_name?.trim() ?? ''}
		accessToken={authStore.accessToken}
		onClose={() => {
			showRenameDialog = false;
			ticketToRename = null;
		}}
		onRenamed={() => invalidateAll()}
	/>
{/if}

<!-- Refund payment Dialog -->
{#if cancelRefund.ticketToRefund?.id}
	<RefundTicketDialog
		open={cancelRefund.showRefundDialog}
		ticketId={cancelRefund.ticketToRefund.id}
		eventId={data.event.id}
		accessToken={authStore.accessToken}
		onClose={cancelRefund.closeRefund}
		onRefunded={() => invalidateAll()}
	/>
{/if}

<!-- Cancel online ticket Dialog (optional refund alongside cancellation) -->
{#if cancelRefund.ticketToCancelOnline?.id}
	<AdminCancelTicketDialog
		open={cancelRefund.showOnlineCancelDialog}
		ticketId={cancelRefund.ticketToCancelOnline.id}
		eventId={data.event.id}
		accessToken={authStore.accessToken}
		onClose={cancelRefund.closeOnlineCancel}
		onCancelled={() => invalidateAll()}
	/>
{/if}

<!-- Make Member Modal -->
<MakeMemberModal
	user={memberAdmin.userToMakeMember}
	tiers={memberAdmin.membershipTiers}
	open={memberAdmin.showMakeMemberModal}
	onClose={() => {
		memberAdmin.showMakeMemberModal = false;
		memberAdmin.userToMakeMember = null;
	}}
	onConfirm={memberAdmin.handleMakeMemberConfirm}
	isProcessing={memberAdmin.addMemberPending}
/>

<!-- Blacklist Confirmation Dialog -->
<ConfirmDialog
	isOpen={memberAdmin.showBlacklistDialog}
	title={m['eventTicketsAdmin.blacklistDialogTitle']()}
	message={memberAdmin.ticketToBlacklist
		? `${m['eventTicketsAdmin.blacklistDialogMessage']({
				name: getUserDisplayName(memberAdmin.ticketToBlacklist.user)
			})} ${m['membershipLoss.subscriptionCancelledIfAny']()}`
		: ''}
	confirmText={m['eventTicketsAdmin.blacklistDialogConfirm']()}
	cancelText={m['eventTicketsAdmin.blacklistDialogCancel']()}
	onConfirm={memberAdmin.confirmBlacklist}
	onCancel={memberAdmin.cancelBlacklist}
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
