<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { X, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	interface TicketUser {
		email?: string;
		first_name?: string;
		last_name?: string;
		preferred_name?: string;
	}

	interface TicketTier {
		name?: string;
		price?: number | string;
		currency?: string;
		payment_method?: string;
		venue?: {
			name?: string;
		} | null;
		sector?: {
			name?: string;
		} | null;
	}

	interface TicketSeat {
		label?: string;
		row?: string | null;
		number?: number | null;
		is_accessible?: boolean;
		is_obstructed_view?: boolean;
	}

	interface Ticket {
		id: string;
		status: string;
		user: TicketUser;
		tier?: TicketTier;
		guest_name?: string;
		seat?: TicketSeat;
	}

	interface Props {
		isOpen: boolean;
		ticket: Ticket | null;
		needsPaymentConfirmation: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		isLoading?: boolean;
	}

	let {
		isOpen,
		ticket,
		needsPaymentConfirmation,
		onConfirm,
		onCancel,
		isLoading = false
	}: Props = $props();

	/**
	 * Get user display name
	 */
	function getUserDisplayName(user: TicketUser): string {
		if (user.preferred_name) return user.preferred_name;
		if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
		if (user.first_name) return user.first_name;
		if (user.email) return user.email;
		return 'Unknown User';
	}

	/**
	 * Get guest name if different from user display name
	 */
	function getGuestNameIfDifferent(ticket: Ticket): string | null {
		const guestName = ticket.guest_name;
		if (!guestName) return null;
		const userDisplayName = getUserDisplayName(ticket.user);
		if (guestName.toLowerCase().trim() === userDisplayName.toLowerCase().trim()) return null;
		return guestName;
	}

	/**
	 * Get venue/sector/seat display info from tier and seat
	 */
	function getSeatDisplay(ticket: Ticket): string | null {
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
			if (seat.row) parts.push(`Row ${seat.row}`);
			if (seat.number) parts.push(`Seat ${seat.number}`);
			if (seat.label && !seat.row && !seat.number) parts.push(seat.label);
			if (seat.is_accessible) parts.push('♿');
			if (seat.is_obstructed_view) parts.push('⚠️ Obstructed');
		}

		return parts.length > 0 ? parts.join(' • ') : null;
	}

	/**
	 * Format price with currency
	 */
	function formatPrice(price: number | string | undefined, currency: string | undefined): string {
		if (price === undefined || price === null) return 'Free';
		const numPrice = typeof price === 'string' ? parseFloat(price) : price;
		if (numPrice === 0) return 'Free';
		const currencySymbol = currency?.toUpperCase() || 'USD';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currencySymbol
		}).format(numPrice);
	}

	/**
	 * Get payment method label
	 */
	function getPaymentMethodLabel(method: string): string {
		switch (method) {
			case 'online':
				return 'Online (Stripe)';
			case 'offline':
				return 'Offline';
			case 'at_the_door':
				return 'At the Door';
			case 'free':
				return 'Free';
			default:
				return method;
		}
	}

	/**
	 * Get status display info
	 */
	function getStatusInfo(status: string): {
		label: string;
		color: string;
		bgColor: string;
	} {
		switch (status) {
			case 'pending':
				return {
					label: 'Pending Payment',
					color: 'text-yellow-700 dark:text-yellow-300',
					bgColor: 'bg-yellow-100 dark:bg-yellow-900/50'
				};
			case 'active':
				return {
					label: 'Active',
					color: 'text-green-700 dark:text-green-300',
					bgColor: 'bg-green-100 dark:bg-green-900/50'
				};
			case 'checked_in':
				return {
					label: 'Already Checked In',
					color: 'text-blue-700 dark:text-blue-300',
					bgColor: 'bg-blue-100 dark:bg-blue-900/50'
				};
			case 'cancelled':
				return {
					label: 'Cancelled',
					color: 'text-red-700 dark:text-red-300',
					bgColor: 'bg-red-100 dark:bg-red-900/50'
				};
			default:
				return {
					label: status,
					color: 'text-gray-700 dark:text-gray-300',
					bgColor: 'bg-gray-100 dark:bg-gray-900/50'
				};
		}
	}

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && !isLoading) {
			onCancel();
		}
	}

	/**
	 * Handle escape key
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !isLoading) {
			onCancel();
		}
	}

	/**
	 * Check if ticket can be checked in
	 */
	function canCheckIn(status: string): boolean {
		return status === 'active';
	}
</script>

{#if isOpen && ticket}
	{@const statusInfo = getStatusInfo(ticket.status)}
	{@const guestName = getGuestNameIfDifferent(ticket)}
	{@const seatInfo = getSeatDisplay(ticket)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}
		transition:fade={{ duration: 150 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="checkin-dialog-title"
		tabindex="-1"
	>
		<div
			class="relative w-full max-w-md rounded-lg border bg-background shadow-lg"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b px-6 py-4">
				<h2 id="checkin-dialog-title" class="text-xl font-bold">
					{needsPaymentConfirmation ? 'Confirm Payment & Check In' : 'Check In Attendee'}
				</h2>
				<button
					type="button"
					onclick={onCancel}
					disabled={isLoading}
					class="rounded-full p-1 hover:bg-accent disabled:opacity-50"
					aria-label="Close dialog"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-4 px-6 py-4">
				<!-- Status Alert -->
				<div class="flex items-center gap-3 rounded-lg border p-3 {statusInfo.bgColor}">
					{#if ticket.status === 'pending'}
						<Clock class="h-5 w-5 shrink-0 {statusInfo.color}" />
					{:else if ticket.status === 'active'}
						<CheckCircle class="h-5 w-5 shrink-0 {statusInfo.color}" />
					{:else if ticket.status === 'checked_in'}
						<CheckCircle class="h-5 w-5 shrink-0 {statusInfo.color}" />
					{:else if ticket.status === 'cancelled'}
						<XCircle class="h-5 w-5 shrink-0 {statusInfo.color}" />
					{:else}
						<AlertCircle class="h-5 w-5 shrink-0 {statusInfo.color}" />
					{/if}
					<div class="flex-1">
						<p class="font-semibold {statusInfo.color}">{statusInfo.label}</p>
						{#if ticket.status === 'checked_in'}
							<p class="text-sm {statusInfo.color}">{m['checkInDialog.alreadyCheckedIn']()}</p>
						{:else if ticket.status === 'cancelled'}
							<p class="text-sm {statusInfo.color}">{m['checkInDialog.ticketCancelled']()}</p>
						{:else if needsPaymentConfirmation}
							<p class="text-sm {statusInfo.color}">
								Please confirm payment has been received before checking in.
							</p>
						{:else}
							<p class="text-sm {statusInfo.color}">
								Please verify the attendee's identity before checking them in.
							</p>
						{/if}
					</div>
				</div>

				<!-- Attendee Information -->
				<div class="rounded-lg border bg-muted/50">
					<div class="border-b px-4 py-3">
						<h3 class="font-semibold">{m['checkInDialog.attendeeInfo']()}</h3>
					</div>
					<div class="divide-y">
						{#if guestName}
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">Guest Name</span>
								<span class="font-medium text-primary">{guestName}</span>
							</div>
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">Purchased By</span>
								<span class="font-medium">{getUserDisplayName(ticket.user)}</span>
							</div>
						{:else}
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">{m['checkInDialog.name']()}</span>
								<span class="font-medium">{getUserDisplayName(ticket.user)}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-sm text-muted-foreground">{m['checkInDialog.email']()}</span>
							<span class="font-medium">{ticket.user.email || 'N/A'}</span>
						</div>
						{#if seatInfo}
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">Seat</span>
								<span class="font-medium text-primary">{seatInfo}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-sm text-muted-foreground">{m['checkInDialog.tier']()}</span>
							<span class="font-medium">{ticket.tier?.name || 'N/A'}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-sm text-muted-foreground">{m['checkInDialog.price']()}</span>
							<span class="font-medium">
								{formatPrice(ticket.tier?.price, ticket.tier?.currency)}
							</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-sm text-muted-foreground">{m['checkInDialog.paymentMethod']()}</span
							>
							<span class="font-medium">
								{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
							</span>
						</div>
					</div>
				</div>

				{#if needsPaymentConfirmation}
					<div
						class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
					>
						<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
						<p>
							<strong>{m['checkInDialog.paymentRequired']()}</strong> Please ensure payment has been
							received before proceeding.
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 border-t px-6 py-4">
				<Button variant="outline" onclick={onCancel} disabled={isLoading}
					>{m['checkInDialog.cancel']()}</Button
				>
				<Button
					variant="default"
					onclick={onConfirm}
					disabled={isLoading || !canCheckIn(ticket.status)}
				>
					{#if isLoading}
						Checking In...
					{:else if needsPaymentConfirmation}
						Confirm Payment & Check In
					{:else}
						Check In
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
