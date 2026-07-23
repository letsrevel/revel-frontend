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
		eventadminticketsCancelTicket,
		eventadminticketsCheckInTicket,
		eventadminticketsGetTicket,
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
	import {
		toCheckInTicket,
		type CheckInDialogTicket
	} from '$lib/components/tickets/checkin-adapter';
	import { createTicketMemberAdmin } from '$lib/components/tickets/ticket-member-admin.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';
	import ReseatDialog from '$lib/components/tickets/ReseatDialog.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import { isSeriesPassCode } from '$lib/utils/series-pass-qr';

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
	let showCancelDialog = $state(false);
	let ticketToCancel = $state<AdminTicketSchema | null>(null);
	let showConfirmPaymentDialog = $state(false);
	let ticketToConfirm = $state<AdminTicketSchema | null>(null);
	let showCheckInDialog = $state(false);
	let ticketToCheckIn = $state<CheckInDialogTicket | null>(null);
	let showQRScanner = $state(false);
	let showReseatDialog = $state(false);
	let ticketToReseat = $state<AdminTicketSchema | null>(null);

	// Membership + blacklist admin actions (state, mutations, handlers).
	const memberAdmin = createTicketMemberAdmin({
		getSlug: () => data.event.organization.slug,
		getAccessToken: () => $page.data.user?.accessToken
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
		// `code` is a ticket UUID or a series-pass QR payload (`series:<uuid>`);
		// the backend resolves pass codes to the holder's ticket for this event.
		mutationFn: async ({ code, pricePaid }: { code: string; pricePaid?: string }) => {
			const response = await eventadminticketsCheckInTicket({
				path: { event_id: data.event.id, code },
				body: pricePaid ? { price_paid: pricePaid } : undefined,
				headers: { Authorization: `Bearer ${$page.data.user?.accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? String(response.error.detail)
						: m['eventTicketsAdmin.checkInError']();
				// silent: the onError below shows the specific message; without the
				// flag the global mutations.onError in +layout.svelte adds a second
				// generic "Action failed" toast for the same failure.
				throw Object.assign(new Error(errorDetail), { silent: true });
			}

			return response.data;
		},
		onSuccess: () => {
			showCheckInDialog = false;
			ticketToCheckIn = null;
			invalidateAll();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : m['eventTicketsAdmin.checkInError']());
		}
	}));

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

	/**
	 * Navigate to page
	 */
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

	/**
	 * Close confirm payment dialog
	 */
	function closeConfirmPaymentDialog() {
		showConfirmPaymentDialog = false;
		ticketToConfirm = null;
		pwycPricePaid = '';
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
			checkInTicketMutation.mutate({ code: ticketToCheckIn.id, pricePaid });
		}
	}

	/**
	 * Handle QR code scan.
	 *
	 * Ticket QRs carry a ticket UUID we can preview via GET before confirming.
	 * Series-pass QRs carry `series:<uuid>` — there is no preview endpoint for
	 * those, so we check in directly and report the resolved attendee.
	 */
	async function handleQRScan(code: string) {
		if (isSeriesPassCode(code)) {
			showQRScanner = false;
			checkInTicketMutation.mutate(
				{ code },
				{
					onSuccess: (checkedIn) => {
						toast.success(
							m['eventTicketsAdmin.passCheckInSuccess']({
								name: checkedIn ? getUserDisplayName(checkedIn.user) : ''
							})
						);
					}
				}
			);
			return;
		}
		try {
			// Fetch ticket details
			const response = await eventadminticketsGetTicket({
				path: { event_id: data.event.id, ticket_id: code },
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

	/**
	 * Open the reseat dialog for a seated ticket.
	 */
	function handleReseat(ticket: AdminTicketSchema) {
		ticketToReseat = ticket;
		showReseatDialog = true;
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
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-3xl font-bold">{m['eventTicketsAdmin.pageTitle']()}</h1>
				<p class="mt-2 text-muted-foreground">{m['eventTicketsAdmin.pageDescription']()}</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
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
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
			>
				<Ticket class="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<h3 class="mb-2 text-lg font-semibold">{m['eventTicketsAdmin.noTicketsFiltered']()}</h3>
				<p class="text-sm text-muted-foreground">
					{#if searchQuery || selectedStatus || selectedPaymentMethod || selectedSource}
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
				addMemberPending={memberAdmin.addMemberPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				tiersLoading={memberAdmin.tiersLoading}
				onCheckIn={handleCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={memberAdmin.openMakeMemberModal}
				onCancelTicket={handleCancelTicket}
				onBlacklist={memberAdmin.openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
				onReseat={handleReseat}
			/>

			<!-- Mobile Cards -->
			<TicketCardList
				tickets={data.tickets}
				checkInPending={checkInTicketMutation.isPending}
				confirmPaymentPending={confirmPaymentMutation.isPending}
				cancelTicketPending={cancelTicketMutation.isPending}
				addMemberPending={memberAdmin.addMemberPending}
				unconfirmPaymentPending={unconfirmPaymentMutation.isPending}
				tiersLoading={memberAdmin.tiersLoading}
				onCheckIn={handleCheckIn}
				onConfirmPayment={handleConfirmPayment}
				onMakeMember={memberAdmin.openMakeMemberModal}
				onCancelTicket={handleCancelTicket}
				onBlacklist={memberAdmin.openBlacklistDialog}
				onUnconfirmPayment={openUnconfirmPaymentDialog}
				onReseat={handleReseat}
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

<!-- Reseat (move seat) Dialog -->
<ReseatDialog
	open={showReseatDialog}
	ticket={ticketToReseat}
	eventId={data.event.id}
	accessToken={$page.data.user?.accessToken ?? null}
	onClose={() => {
		showReseatDialog = false;
		ticketToReseat = null;
	}}
	onReseated={() => invalidateAll()}
/>

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
		? m['eventTicketsAdmin.blacklistDialogMessage']({
				name: getUserDisplayName(memberAdmin.ticketToBlacklist.user)
			})
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
