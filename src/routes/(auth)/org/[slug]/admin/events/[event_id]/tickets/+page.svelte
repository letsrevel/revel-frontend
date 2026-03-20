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
	import { Ticket, AlertTriangle, QrCode, X } from 'lucide-svelte';
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
	import type { PageData } from './$types';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import TicketFilters from '$lib/components/tickets/TicketFilters.svelte';
	import TicketTable from '$lib/components/tickets/TicketTable.svelte';
	import TicketCardList from '$lib/components/tickets/TicketCardList.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';

	const { data }: { data: PageData } = $props();

	// Search state
	let searchQuery = $state(data.filters.search || '');
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Filter states
	let selectedStatus = $state<string | null>(data.filters.status || null);
	let selectedPaymentMethod = $state<string | null>(data.filters.paymentMethod || null);

	// Confirmation dialogs
	let showCancelDialog = $state(false);
	let ticketToCancel = $state<any>(null);
	let showConfirmPaymentDialog = $state(false);
	let ticketToConfirm = $state<any>(null);
	let showCheckInDialog = $state(false);
	let ticketToCheckIn = $state<any>(null);
	let showQRScanner = $state(false);

	// Make member modal state
	let showMakeMemberModal = $state(false);
	let userToMakeMember = $state<{ id: string; displayName: string; email?: string } | null>(null);
	let membershipTiers = $state<MembershipTierSchema[]>([]);
	let tiersLoading = $state(false);

	// Blacklist confirmation state
	let showBlacklistDialog = $state(false);
	let ticketToBlacklist = $state<any>(null);

	// Unconfirm payment confirmation state
	let showUnconfirmPaymentDialog = $state(false);
	let ticketToUnconfirm = $state<any>(null);

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
				throw new Error('Failed to blacklist user');
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = ticketToBlacklist ? getUserDisplayName(ticketToBlacklist.user) : '';
			showBlacklistDialog = false;
			ticketToBlacklist = null;
			toast.success(`${userName} has been blacklisted`);
			invalidateAll();
		},
		onError: () => {
			toast.error('Failed to blacklist user');
		}
	}));

	/**
	 * Open make member modal
	 */
	async function openMakeMemberModal(ticket: any) {
		const user = ticket.user;
		if (!user?.id) {
			toast.error('User ID not available');
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
			email: user.email
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
	function openBlacklistDialog(ticket: any) {
		if (!ticket.user?.id) {
			toast.error('User ID not available');
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
	function openUnconfirmPaymentDialog(ticket: any) {
		ticketToUnconfirm = ticket;
		showUnconfirmPaymentDialog = true;
	}

	/**
	 * Confirm unconfirm payment
	 */
	function confirmUnconfirmPayment() {
		if (ticketToUnconfirm) {
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
	function handleSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;

		// Debounce search
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			applyFilters();
		}, 300);
	}

	/**
	 * Apply filters to URL
	 */
	function applyFilters() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (selectedStatus) params.set('status', selectedStatus);
		if (selectedPaymentMethod) params.set('payment_method', selectedPaymentMethod);
		// Reset to page 1 when filters change
		params.set('page', '1');

		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
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
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	/**
	 * Handle confirm payment
	 */
	function handleConfirmPayment(ticket: any) {
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
		if (ticketToConfirm) {
			const pricePaid = isPwycTicket(ticketToConfirm) ? pwycPricePaid : undefined;
			confirmPaymentMutation.mutate({ ticketId: ticketToConfirm.id, pricePaid });
		}
	}

	/**
	 * Handle cancel ticket
	 */
	function handleCancelTicket(ticket: any) {
		ticketToCancel = ticket;
		showCancelDialog = true;
	}

	/**
	 * Submit cancel ticket
	 */
	function submitCancelTicket() {
		if (ticketToCancel) {
			cancelTicketMutation.mutate(ticketToCancel.id);
		}
	}

	/**
	 * Handle manual check-in
	 */
	function handleCheckIn(ticket: any) {
		ticketToCheckIn = ticket;
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
			ticketToCheckIn = response.data;
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
	<div class="space-y-4">
		<!-- Warning for incomplete data -->
		{#if hasMultiplePages}
			<div
				class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
				role="alert"
			>
				<AlertTriangle class="h-5 w-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-medium">Numbers shown are for the current page only</p>
					<p class="text-sm">
						Total tickets: {data.totalCount}. Navigate through pages to see all tickets.
					</p>
				</div>
			</div>
		{/if}

		<!-- Stats grid -->
		<div class="grid gap-4 sm:grid-cols-5">
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold">{stats.total}</div>
				<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsTotalPage']()}</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-yellow-600">{stats.pending}</div>
				<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsPending']()}</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-green-600">{stats.active}</div>
				<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsActive']()}</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-blue-600">{stats.checkedIn}</div>
				<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsCheckedIn']()}</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-red-600">{stats.cancelled}</div>
				<div class="text-sm text-muted-foreground">{m['eventTicketsAdmin.statsCancelled']()}</div>
			</div>
		</div>
	</div>

	<!-- Search and Filters -->
	<TicketFilters
		{searchQuery}
		{selectedStatus}
		{selectedPaymentMethod}
		onSearch={handleSearch}
		onStatusFilter={setStatusFilter}
		onPaymentMethodFilter={setPaymentMethodFilter}
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
					Showing page {data.currentPage} of {Math.ceil(data.totalCount / data.pageSize)}
					({data.totalCount} total tickets)
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => goToPage(data.currentPage - 1)}
						disabled={!data.previousPage}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => goToPage(data.currentPage + 1)}
						disabled={!data.nextPage}
					>
						Next
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
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
				aria-label="Close dialog"
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
						Amount paid ({ticketToConfirm.tier?.currency?.toUpperCase() || 'EUR'})
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
						Confirming...
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
	title="Blacklist User"
	message={ticketToBlacklist
		? `Are you sure you want to blacklist ${getUserDisplayName(ticketToBlacklist.user)}? They will be blocked from all events in this organization.`
		: ''}
	confirmText="Blacklist"
	cancelText="Cancel"
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
