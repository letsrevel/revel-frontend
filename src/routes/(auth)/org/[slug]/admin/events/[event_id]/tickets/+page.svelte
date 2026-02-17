<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { fade, scale } from 'svelte/transition';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Search,
		Check,
		X,
		Ticket,
		CreditCard,
		Banknote,
		Coins,
		Gift,
		AlertTriangle,
		QrCode,
		ExternalLink,
		UserPlus,
		MoreVertical,
		Ban,
		Undo2
	} from 'lucide-svelte';
	import {
		eventadminticketsConfirmTicketPayment,
		eventadminticketsUnconfirmTicketPayment,
		eventadminticketsCancelTicket,
		eventadminticketsCheckInTicket,
		eventadminticketsGetTicket,
		organizationadminmembersListMembershipTiers,
		organizationadminmembersAddMember,
		organizationadminblacklistCreateBlacklistEntry
	} from '$lib/api';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { PageData } from './$types';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import QRScannerModal from '$lib/components/tickets/QRScannerModal.svelte';
	import CheckInDialog from '$lib/components/tickets/CheckInDialog.svelte';
	import MakeMemberModal from '$lib/components/members/MakeMemberModal.svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

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
	 * Check if payment can be unconfirmed (active ticket with offline/at_the_door payment)
	 */
	function canUnconfirmPayment(ticket: any): boolean {
		const method = ticket.tier?.payment_method;
		return ticket.status === 'active' && (method === 'offline' || method === 'at_the_door');
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
	 * Check if a ticket's tier is PWYC with offline/at_the_door payment
	 */
	function isPwycTicket(ticket: any): boolean {
		return (
			ticket.tier?.price_type === 'pwyc' &&
			(ticket.tier?.payment_method === 'offline' || ticket.tier?.payment_method === 'at_the_door')
		);
	}

	/**
	 * Get PWYC range warning message, if applicable
	 */
	function getPwycWarning(ticket: any, value: string): string | null {
		const num = parseFloat(value);
		if (isNaN(num) || num <= 0) return null;

		const min = ticket.tier?.pwyc_min ? parseFloat(ticket.tier.pwyc_min) : null;
		const max = ticket.tier?.pwyc_max ? parseFloat(ticket.tier.pwyc_max) : null;

		if (min !== null && max !== null && (num < min || num > max)) {
			const currency = ticket.tier?.currency?.toUpperCase() || 'EUR';
			const fmt = (v: number) =>
				new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v);
			return `This amount is outside the suggested range (${fmt(min)} \u2013 ${fmt(max)})`;
		}
		if (min !== null && max === null && num < min) {
			const currency = ticket.tier?.currency?.toUpperCase() || 'EUR';
			const fmt = (v: number) =>
				new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v);
			return `This amount is below the suggested minimum (${fmt(min)})`;
		}
		return null;
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
	 * Get guest name if different from user display name
	 */
	function getGuestNameIfDifferent(ticket: any): string | null {
		const guestName = ticket.guest_name;
		if (!guestName) return null;
		const userDisplayName = getUserDisplayName(ticket.user);
		// Check if guest name is meaningfully different from user display name
		if (guestName.toLowerCase().trim() === userDisplayName.toLowerCase().trim()) return null;
		return guestName;
	}

	/**
	 * Get venue/sector/seat display info from tier and seat
	 */
	function getSeatDisplay(ticket: any): string | null {
		const tier = ticket.tier;
		const seat = ticket.seat;

		// If no venue/sector on tier and no seat, nothing to show
		if (!tier?.venue && !tier?.sector && !seat) return null;

		const parts: string[] = [];

		// Add venue name from tier
		if (tier?.venue?.name) parts.push(tier.venue.name);

		// Add sector name from tier
		if (tier?.sector?.name) parts.push(tier.sector.name);

		// Add seat info if available
		if (seat) {
			// MinimalSeatSchema has: label, row, number, is_accessible, is_obstructed_view
			if (seat.row) parts.push(`Row ${seat.row}`);
			if (seat.number) parts.push(`Seat ${seat.number}`);
			if (seat.label && !seat.row && !seat.number) parts.push(seat.label);
			if (seat.is_accessible) parts.push('♿');
			if (seat.is_obstructed_view) parts.push('⚠️ Obstructed');
		}

		return parts.length > 0 ? parts.join(' • ') : null;
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
				return m['eventTicketsAdmin.paymentOffline']();
			case 'at_the_door':
				return m['eventTicketsAdmin.paymentAtDoor']();
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

	/**
	 * Get the effective price for a ticket.
	 * Priority: payment.amount > price_paid > tier.price
	 */
	function getTicketPrice(ticket: any): number | string | undefined {
		// Payment object always prevails (online payments via Stripe)
		if (ticket.payment?.amount !== undefined && ticket.payment?.amount !== null) {
			return ticket.payment.amount;
		}
		// Then price_paid (PWYC or admin-confirmed offline payments)
		if (ticket.price_paid !== undefined && ticket.price_paid !== null) {
			return ticket.price_paid;
		}
		// Fall back to tier price
		return ticket.tier?.price;
	}
</script>

{#snippet paymentMethodIcon(method: string)}
	{#if method === 'online'}
		<CreditCard class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'offline'}
		<Banknote class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'at_the_door'}
		<Coins class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'free'}
		<Gift class="h-3 w-3" aria-hidden="true" />
	{:else}
		<CreditCard class="h-3 w-3" aria-hidden="true" />
	{/if}
{/snippet}

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
			<h3 class="mb-2 text-sm font-semibold">{m['eventTicketsAdmin.filterByStatus']()}</h3>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => setStatusFilter(null)}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					null
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.filterAll']()}
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('pending')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'pending'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.statsPending']()}
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('active')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'active'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.statsActive']()}
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('checked_in')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'checked_in'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.statsCheckedIn']()}
				</button>
				<button
					type="button"
					onclick={() => setStatusFilter('cancelled')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
					'cancelled'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.statsCancelled']()}
				</button>
			</div>
		</div>

		<!-- Payment Method Filters -->
		<div>
			<h3 class="mb-2 text-sm font-semibold">{m['eventTicketsAdmin.filterByPaymentMethod']()}</h3>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => setPaymentMethodFilter(null)}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					null
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.filterAll']()}
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('online')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'online'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.paymentOnline']()}
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('offline')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'offline'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.paymentOffline']()}
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('at_the_door')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'at_the_door'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.paymentAtDoor']()}
				</button>
				<button
					type="button"
					onclick={() => setPaymentMethodFilter('free')}
					class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
					'free'
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
				>
					{m['eventTicketsAdmin.paymentFree']()}
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
								>{m['eventTicketsAdmin.headerPaymentMethod']()}</th
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
							{@const guestName = getGuestNameIfDifferent(ticket)}
							{@const seatInfo = getSeatDisplay(ticket)}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<div class="flex items-start gap-3">
										<UserAvatar
											profilePictureUrl={ticket.user.profile_picture_url}
											previewUrl={ticket.user.profile_picture_preview_url}
											thumbnailUrl={ticket.user.profile_picture_thumbnail_url}
											displayName={getUserDisplayName(ticket.user)}
											firstName={ticket.user.first_name}
											lastName={ticket.user.last_name}
											size="sm"
											clickable={true}
										/>
										<div>
											{#if guestName}
												<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
													<span class="font-medium">{guestName}</span>
												</div>
												<div class="text-sm text-muted-foreground">
													(Purchased by {getUserDisplayName(ticket.user)})
												</div>
											{:else}
												<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
													<span class="font-medium">{getUserDisplayName(ticket.user)}</span>
													{#if ticket.user.pronouns}
														<span class="text-xs text-muted-foreground"
															>({ticket.user.pronouns})</span
														>
													{/if}
													{#if ticket.membership}
														<Badge variant="secondary" class="text-xs">
															{ticket.membership.tier?.name
																? m['memberBadge.tierName']({ tier: ticket.membership.tier.name })
																: m['memberBadge.member']()}
														</Badge>
													{/if}
												</div>
											{/if}
											<div class="text-sm text-muted-foreground">
												{getUserEmail(ticket.user)}
											</div>
											{#if seatInfo}
												<div class="mt-1 text-xs text-primary">
													{seatInfo}
												</div>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="font-medium">{ticket.tier?.name || 'N/A'}</div>
								</td>
								<td class="px-4 py-3">
									<div class="font-medium">
										{formatPrice(
											getTicketPrice(ticket),
											ticket.payment?.currency || ticket.tier?.currency
										)}
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1 text-sm">
										{@render paymentMethodIcon(ticket.tier?.payment_method || '')}
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
												{m['eventTicketsAdmin.actionCheckIn']()}
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
												{m['eventTicketsAdmin.actionConfirmPayment']()}
											</Button>
										{/if}
										{#if !ticket.membership && ticket.user?.id}
											<Button
												size="sm"
												variant="outline"
												onclick={() => openMakeMemberModal(ticket)}
												disabled={addMemberMutation.isPending || tiersLoading}
											>
												<UserPlus class="h-4 w-4" aria-hidden="true" />
												{m['makeMemberAction.button']()}
											</Button>
										{/if}
										{#if ticket.tier?.payment_method === 'online' && ticket.payment?.stripe_dashboard_url}
											<Button
												size="sm"
												variant="outline"
												onclick={() => window.open(ticket.payment.stripe_dashboard_url, '_blank')}
											>
												<ExternalLink class="h-4 w-4" aria-hidden="true" />
												Manage on Stripe
											</Button>
										{/if}
										<!-- More actions dropdown -->
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														class="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
														aria-label="More actions for {getUserDisplayName(ticket.user)}"
													>
														<MoreVertical class="h-4 w-4" aria-hidden="true" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end">
												{#if canUnconfirmPayment(ticket)}
													<DropdownMenu.Item
														onclick={() => openUnconfirmPaymentDialog(ticket)}
														disabled={unconfirmPaymentMutation.isPending}
													>
														<Undo2 class="mr-2 h-4 w-4" aria-hidden="true" />
														{m['eventTicketsAdmin.actionUnconfirmPayment']()}
													</DropdownMenu.Item>
												{/if}
												{#if canManageTicket(ticket) && ticket.status !== 'cancelled'}
													<DropdownMenu.Item
														onclick={() => handleCancelTicket(ticket)}
														disabled={cancelTicketMutation.isPending}
														class="text-destructive focus:text-destructive"
													>
														<X class="mr-2 h-4 w-4" aria-hidden="true" />
														Cancel Ticket
													</DropdownMenu.Item>
												{/if}
												{#if ticket.user?.id}
													<DropdownMenu.Item
														onclick={() => openBlacklistDialog(ticket)}
														class="text-destructive focus:text-destructive"
													>
														<Ban class="mr-2 h-4 w-4" aria-hidden="true" />
														Blacklist User
													</DropdownMenu.Item>
												{/if}
											</DropdownMenu.Content>
										</DropdownMenu.Root>
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
					{@const guestName = getGuestNameIfDifferent(ticket)}
					{@const seatInfo = getSeatDisplay(ticket)}
					<div class="rounded-lg border bg-card p-4">
						<div class="mb-3 flex items-start justify-between gap-2">
							<div class="flex flex-1 items-start gap-3">
								<UserAvatar
									profilePictureUrl={ticket.user.profile_picture_url}
									previewUrl={ticket.user.profile_picture_preview_url}
									thumbnailUrl={ticket.user.profile_picture_thumbnail_url}
									displayName={getUserDisplayName(ticket.user)}
									firstName={ticket.user.first_name}
									lastName={ticket.user.last_name}
									size="md"
									clickable={true}
								/>
								<div>
									{#if guestName}
										<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span class="font-semibold">{guestName}</span>
										</div>
										<div class="text-sm text-muted-foreground">
											(Purchased by {getUserDisplayName(ticket.user)})
										</div>
									{:else}
										<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span class="font-semibold">{getUserDisplayName(ticket.user)}</span>
											{#if ticket.user.pronouns}
												<span class="text-xs text-muted-foreground">({ticket.user.pronouns})</span>
											{/if}
											{#if ticket.membership}
												<Badge variant="secondary" class="text-xs">
													{ticket.membership.tier?.name
														? m['memberBadge.tierName']({ tier: ticket.membership.tier.name })
														: m['memberBadge.member']()}
												</Badge>
											{/if}
										</div>
									{/if}
									<div class="text-sm text-muted-foreground">{getUserEmail(ticket.user)}</div>
									{#if seatInfo}
										<div class="mt-1 text-xs text-primary">{seatInfo}</div>
									{/if}
								</div>
							</div>
							<span class={cn('shrink-0', getStatusColor(ticket.status))}>
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
									>{formatPrice(
										getTicketPrice(ticket),
										ticket.payment?.currency || ticket.tier?.currency
									)}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">{m['eventTicketsAdmin.labelPayment']()}:</span>
								<span class="flex items-center gap-1">
									{@render paymentMethodIcon(ticket.tier?.payment_method || '')}
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
							{#if !ticket.membership && ticket.user?.id}
								<Button
									size="sm"
									variant="outline"
									onclick={() => openMakeMemberModal(ticket)}
									disabled={addMemberMutation.isPending || tiersLoading}
									class="flex-1"
								>
									<UserPlus class="h-4 w-4" aria-hidden="true" />
									{m['makeMemberAction.button']()}
								</Button>
							{/if}
							{#if ticket.tier?.payment_method === 'online' && ticket.payment?.stripe_dashboard_url}
								<Button
									size="sm"
									variant="outline"
									onclick={() => window.open(ticket.payment.stripe_dashboard_url, '_blank')}
									class="w-full"
								>
									<ExternalLink class="h-4 w-4" aria-hidden="true" />
									Manage on Stripe
								</Button>
							{/if}
							<!-- More actions dropdown for mobile -->
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											aria-label="More actions for {getUserDisplayName(ticket.user)}"
										>
											<MoreVertical class="h-4 w-4" aria-hidden="true" />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#if canUnconfirmPayment(ticket)}
										<DropdownMenu.Item
											onclick={() => openUnconfirmPaymentDialog(ticket)}
											disabled={unconfirmPaymentMutation.isPending}
										>
											<Undo2 class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['eventTicketsAdmin.actionUnconfirmPayment']()}
										</DropdownMenu.Item>
									{/if}
									{#if canManageTicket(ticket) && ticket.status !== 'cancelled'}
										<DropdownMenu.Item
											onclick={() => handleCancelTicket(ticket)}
											disabled={cancelTicketMutation.isPending}
											class="text-destructive focus:text-destructive"
										>
											<X class="mr-2 h-4 w-4" aria-hidden="true" />
											Cancel Ticket
										</DropdownMenu.Item>
									{/if}
									{#if ticket.user?.id}
										<DropdownMenu.Item
											onclick={() => openBlacklistDialog(ticket)}
											class="text-destructive focus:text-destructive"
										>
											<Ban class="mr-2 h-4 w-4" aria-hidden="true" />
											Blacklist User
										</DropdownMenu.Item>
									{/if}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
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
						type="number"
						step="0.01"
						min="0.01"
						bind:value={pwycPricePaid}
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
