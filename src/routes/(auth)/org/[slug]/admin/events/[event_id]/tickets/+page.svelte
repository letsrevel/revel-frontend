<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Search,
		Check,
		X,
		Ticket,
		CreditCard,
		AlertTriangle,
		QrCode,
		ExternalLink
	} from 'lucide-svelte';
	import {
		eventadminConfirmTicketPayment,
		eventadminCancelTicket,
		eventadminCheckInTicket,
		eventadminGetTicket
	} from '$lib/api';
	import type { PageData } from './$types';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';

	let { data }: { data: PageData } = $props();

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

	/**
	 * Derived: Check if there are multiple pages
	 */
	let hasMultiplePages = $derived(!!(data.nextPage || data.previousPage));

	/**
	 * Derived: Calculate stats from current page tickets
	 */
	let stats = $derived.by(() => {
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
		mutationFn: async (ticketId: string) => {
			const response = await eventadminConfirmTicketPayment({
				path: { event_id: data.event.id, ticket_id: ticketId },
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
			invalidateAll();
		}
	}));

	/**
	 * Cancel ticket mutation
	 */
	const cancelTicketMutation = createMutation(() => ({
		mutationFn: async (ticketId: string) => {
			const response = await eventadminCancelTicket({
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
		mutationFn: async (ticketId: string) => {
			const response = await eventadminCheckInTicket({
				path: { event_id: data.event.id, ticket_id: ticketId },
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
		showConfirmPaymentDialog = true;
	}

	/**
	 * Submit confirm payment
	 */
	function submitConfirmPayment() {
		if (ticketToConfirm) {
			confirmPaymentMutation.mutate(ticketToConfirm.id);
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
	function submitCheckIn() {
		if (ticketToCheckIn) {
			checkInTicketMutation.mutate(ticketToCheckIn.id);
		}
	}

	/**
	 * Handle QR code scan
	 */
	async function handleQRScan(ticketId: string) {
		try {
			// Fetch ticket details
			const response = await eventadminGetTicket({
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

	/**
	 * Get user display name
	 */
	function getUserDisplayName(user: any): string {
		if (user.preferred_name) return user.preferred_name;
		if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
		if (user.first_name) return user.first_name;
		if (user.email) return user.email;
		return m['eventTicketsAdmin.unknownUser']();
	}

	/**
	 * Get user email
	 */
	function getUserEmail(user: any): string {
		return user.email || 'N/A';
	}

	/**
	 * Get status color classes
	 */
	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending':
				return 'rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
			case 'active':
				return 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-100';
			case 'checked_in':
				return 'rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100';
			case 'cancelled':
				return 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-100';
			default:
				return 'rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-900 dark:text-gray-100';
		}
	}

	/**
	 * Get status label
	 */
	function getStatusLabel(status: string): string {
		switch (status) {
			case 'pending':
				return m['eventTicketsAdmin.statusPending']();
			case 'active':
				return m['eventTicketsAdmin.statusActive']();
			case 'checked_in':
				return m['eventTicketsAdmin.statusCheckedIn']();
			case 'cancelled':
				return m['eventTicketsAdmin.statusCancelled']();
			default:
				return status;
		}
	}

	/**
	 * Get payment method label
	 */
	function getPaymentMethodLabel(method: string): string {
		switch (method) {
			case 'online':
				return m['eventTicketsAdmin.paymentOnline']();
			case 'offline':
				return m['eventTicketsAdmin.labelPayment']();
			case 'at_the_door':
				return m['eventTicketsAdmin.labelPayment']();
			case 'free':
				return m['eventTicketsAdmin.paymentFree']();
			default:
				return method;
		}
	}

	/**
	 * Check if ticket can be managed (non-Stripe)
	 */
	function canManageTicket(ticket: any): boolean {
		const method = ticket.tier?.payment_method;
		return method === 'offline' || method === 'at_the_door' || method === 'free';
	}

	/**
	 * Check if ticket can be checked in
	 */
	function canCheckIn(ticket: any): boolean {
		return ticket.status === 'active' || needsPaymentConfirmation(ticket);
	}

	/**
	 * Check if payment needs confirmation at check-in
	 */
	function needsPaymentConfirmation(ticket: any): boolean {
		const method = ticket.tier?.payment_method;
		return ticket.status === 'pending' && (method === 'offline' || method === 'at_the_door');
	}

	/**
	 * Check if payment can be confirmed
	 */
	function canConfirmPayment(ticket: any): boolean {
		const method = ticket.tier?.payment_method;
		return (
			(ticket.status === 'pending' || ticket.status === 'cancelled') &&
			(method === 'offline' || method === 'at_the_door')
		);
	}

	/**
	 * Format price with currency
	 */
	function formatPrice(price: number | string | undefined, currency: string | undefined): string {
		if (price === undefined || price === null) return m['eventTicketsAdmin.free']();
		const numPrice = typeof price === 'string' ? parseFloat(price) : price;
		if (numPrice === 0) return m['eventTicketsAdmin.free']();
		const currencySymbol = currency?.toUpperCase() || 'USD';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencySymbol
		}).format(numPrice);
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
		<h1 class="text-3xl font-bold">{m['eventTicketsAdmin.pageTitle']()}</h1>
		<p class="mt-2 text-muted-foreground">{m['eventTicketsAdmin.pageDescription']()}</p>
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
			Scan attendee QR codes to check them in to the event
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
				<div class="text-sm text-muted-foreground">Total (page)</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-yellow-600">{stats.pending}</div>
				<div class="text-sm text-muted-foreground">Pending</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-green-600">{stats.active}</div>
				<div class="text-sm text-muted-foreground">Active</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-blue-600">{stats.checkedIn}</div>
				<div class="text-sm text-muted-foreground">Checked In</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-2xl font-bold text-red-600">{stats.cancelled}</div>
				<div class="text-sm text-muted-foreground">Cancelled</div>
			</div>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="mt-6 space-y-4">
		<!-- Search -->
		<div class="relative">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				type="search"
				placeholder={m['eventTicketsAdmin.searchPlaceholder']()}
				value={searchQuery}
				oninput={handleSearch}
				class="pl-10"
				aria-label="Search tickets"
			/>
		</div>

		<!-- Status Filters -->
		<div>
			<h3 class="mb-2 text-sm font-semibold">Filter by Status</h3>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => setStatusFilter(null)}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					null
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					All
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('pending')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'pending'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Pending
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('active')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'active'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Active
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('checked_in')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'checked_in'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Checked In
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('cancelled')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'cancelled'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Cancelled
				</button>
			</div>
		</div>

		<!-- Payment Method Filters -->
		<div>
			<h3 class="mb-2 text-sm font-semibold">Filter by Payment Method</h3>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => setPaymentMethodFilter(null)}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					null
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					All
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('online')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'online'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Online (Stripe)
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('offline')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'offline'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Offline
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('at_the_door')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'at_the_door'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					At the Door
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('free')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'free'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					Free
				</button>
			</div>
		</div>
	</div>

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
			<div class="hidden overflow-x-auto rounded-lg border md:block">
				<table class="w-full">
					<thead class="border-b bg-muted/50">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.headerAttendee']()}</th
							>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.headerTier']()}</th
							>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.headerPrice']()}</th
							>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.labelPayment']()}</th
							>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.headerStatus']()}</th
							>
							<th class="px-4 py-3 text-left text-sm font-semibold"
								>{m['eventTicketsAdmin.headerPurchased']()}</th
							>
							<th class="px-4 py-3 text-right text-sm font-semibold"
								>{m['eventTicketsAdmin.headerActions']()}</th
							>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.tickets as ticket}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<div>
										<div class="font-medium">{getUserDisplayName(ticket.user)}</div>
										<div class="text-sm text-muted-foreground">
											{getUserEmail(ticket.user)}
										</div>
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="font-medium">{ticket.tier?.name || 'N/A'}</div>
								</td>
								<td class="px-4 py-3">
									<div class="font-medium">
										{formatPrice(ticket.tier?.price, ticket.tier?.currency)}
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1 text-sm">
										<CreditCard class="h-3 w-3" aria-hidden="true" />
										{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
									</div>
								</td>
								<td class="px-4 py-3">
									<span class={getStatusColor(ticket.status)}>
										{getStatusLabel(ticket.status)}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-muted-foreground">
									{new Date(ticket.created_at).toLocaleDateString()}
								</td>
								<td class="px-4 py-3">
									<div class="flex justify-end gap-2">
										{#if canCheckIn(ticket)}
											<Button
												size="sm"
												variant="default"
												onclick={() => handleCheckIn(ticket)}
												disabled={checkInTicketMutation.isPending}
											>
												<Check class="h-4 w-4" aria-hidden="true" />
												Check In
											</Button>
										{/if}
										{#if canConfirmPayment(ticket)}
											<Button
												size="sm"
												variant="default"
												onclick={() => handleConfirmPayment(ticket)}
												disabled={confirmPaymentMutation.isPending}
											>
												<Check class="h-4 w-4" aria-hidden="true" />
												Confirm Payment
											</Button>
										{/if}
										{#if canManageTicket(ticket) && ticket.status !== 'cancelled'}
											<Button
												size="sm"
												variant="outline"
												onclick={() => handleCancelTicket(ticket)}
												disabled={cancelTicketMutation.isPending}
											>
												<X class="h-4 w-4" aria-hidden="true" />
												Cancel
											</Button>
										{/if}
										{#if ticket.tier?.payment_method === 'online'}
											<Button
												size="sm"
												variant="outline"
												onclick={() => window.open('https://dashboard.stripe.com/', '_blank')}
											>
												<ExternalLink class="h-4 w-4" aria-hidden="true" />
												Manage on Stripe
											</Button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile Cards -->
			<div class="space-y-4 md:hidden">
				{#each data.tickets as ticket}
					<div class="rounded-lg border bg-card p-4">
						<div class="mb-3 flex items-start justify-between">
							<div class="flex-1">
								<div class="font-semibold">{getUserDisplayName(ticket.user)}</div>
								<div class="text-sm text-muted-foreground">{getUserEmail(ticket.user)}</div>
							</div>
							<span class={getStatusColor(ticket.status)}>
								{getStatusLabel(ticket.status)}
							</span>
						</div>

						<div class="space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">{m['eventTicketsAdmin.headerTier']()}:</span>
								<span class="font-medium">{ticket.tier?.name || 'N/A'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">{m['eventTicketsAdmin.headerPrice']()}:</span>
								<span class="font-medium"
									>{formatPrice(ticket.tier?.price, ticket.tier?.currency)}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">{m['eventTicketsAdmin.labelPayment']()}:</span>
								<span class="flex items-center gap-1">
									<CreditCard class="h-3 w-3" aria-hidden="true" />
									{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground"
									>{m['eventTicketsAdmin.headerPurchased']()}:</span
								>
								<span>{new Date(ticket.created_at).toLocaleDateString()}</span>
							</div>
						</div>

						<div class="mt-3 flex flex-wrap gap-2">
							{#if canCheckIn(ticket)}
								<Button
									size="sm"
									variant="default"
									onclick={() => handleCheckIn(ticket)}
									disabled={checkInTicketMutation.isPending}
									class="flex-1"
								>
									<Check class="h-4 w-4" aria-hidden="true" />
									{m['eventTicketsAdmin.actionCheckIn']()}
								</Button>
							{/if}
							{#if canConfirmPayment(ticket)}
								<Button
									size="sm"
									variant="default"
									onclick={() => handleConfirmPayment(ticket)}
									disabled={confirmPaymentMutation.isPending}
									class="flex-1"
								>
									<Check class="h-4 w-4" aria-hidden="true" />
									{m['eventTicketsAdmin.actionConfirmPayment']()}
								</Button>
							{/if}
							{#if canManageTicket(ticket) && ticket.status !== 'cancelled'}
								<Button
									size="sm"
									variant="outline"
									onclick={() => handleCancelTicket(ticket)}
									disabled={cancelTicketMutation.isPending}
									class="flex-1"
								>
									<X class="h-4 w-4" aria-hidden="true" />
									Cancel
								</Button>
							{/if}
							{#if ticket.tier?.payment_method === 'online'}
								<Button
									size="sm"
									variant="outline"
									onclick={() => window.open('https://dashboard.stripe.com/', '_blank')}
									class="w-full"
								>
									<ExternalLink class="h-4 w-4" aria-hidden="true" />
									Manage on Stripe
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
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
<ConfirmDialog
	isOpen={showConfirmPaymentDialog}
	title="Confirm Payment"
	message={ticketToConfirm?.status === 'cancelled'
		? 'Are you sure you want to confirm this payment and reactivate the ticket? The ticket holder will be notified.'
		: 'Are you sure you want to confirm this payment and activate the ticket? The ticket holder will be notified.'}
	confirmText="Confirm Payment"
	cancelText="Cancel"
	onConfirm={submitConfirmPayment}
	onCancel={() => {
		showConfirmPaymentDialog = false;
		ticketToConfirm = null;
	}}
	variant="info"
/>

<!-- Cancel Confirmation Dialog -->
<ConfirmDialog
	isOpen={showCancelDialog}
	title="Cancel Ticket"
	message="Are you sure you want to cancel this ticket? This action cannot be undone. The ticket holder will be notified."
	confirmText="Cancel Ticket"
	cancelText="Keep Ticket"
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
