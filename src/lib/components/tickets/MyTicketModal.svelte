<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { UserTicketSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import AddToWalletButton from './AddToWalletButton.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import {
		Ticket,
		Calendar,
		MapPin,
		Download,
		User,
		Armchair,
		ChevronLeft,
		ChevronRight,
		X,
		AlertTriangle
	} from 'lucide-svelte';
	import QRCode from 'qrcode';

	interface Props {
		open: boolean;
		/** Single ticket or array of tickets */
		tickets: UserTicketSchema | UserTicketSchema[];
		eventName: string;
		eventDate?: string;
		eventLocation?: string;
		onResumePayment?: (paymentId: string) => void;
		isResumingPayment?: boolean;
		onCancelReservation?: (paymentId: string) => void;
		isCancellingReservation?: boolean;
	}

	let {
		open = $bindable(),
		tickets,
		eventName,
		eventDate,
		eventLocation,
		onResumePayment,
		isResumingPayment = false,
		onCancelReservation,
		isCancellingReservation = false
	}: Props = $props();

	// Normalize to array and filter out undefined/null values
	let ticketArray = $derived(
		(Array.isArray(tickets) ? tickets : [tickets]).filter((t): t is UserTicketSchema => t != null)
	);
	let totalTickets = $derived(ticketArray.length);
	let hasMultipleTickets = $derived(totalTickets > 1);

	// Current ticket index for navigation
	let currentIndex = $state(0);

	// Current ticket being displayed - with guard for empty array
	let ticket = $derived(ticketArray[currentIndex] ?? ticketArray[0]);

	// Navigation functions
	function goToPrevious() {
		if (currentIndex > 0) {
			currentIndex--;
			qrCodeDataUrl = null; // Reset QR code for new ticket
		}
	}

	function goToNext() {
		if (currentIndex < totalTickets - 1) {
			currentIndex++;
			qrCodeDataUrl = null; // Reset QR code for new ticket
		}
	}

	// Reset to first ticket when modal opens
	$effect(() => {
		if (open) {
			currentIndex = 0;
		}
	});

	let qrCodeDataUrl = $state<string | null>(null);
	let isGenerating = $state(false);

	// Generate QR code when modal opens or ticket changes
	$effect(() => {
		if (open && ticket?.id) {
			// Reset and regenerate for new ticket
			qrCodeDataUrl = null;
			generateQRCode();
		}
	});

	async function generateQRCode() {
		if (!ticket.id) return;

		isGenerating = true;
		try {
			// Generate QR code with ticket ID
			const url = await QRCode.toDataURL(ticket.id, {
				width: 256,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				}
			});
			qrCodeDataUrl = url;
		} catch (err) {
			console.error('Failed to generate QR code:', err);
		} finally {
			isGenerating = false;
		}
	}

	// Format checked in date
	let checkedInDate = $derived.by(() => {
		if (!ticket?.checked_in_at) return null;
		const date = new Date(ticket.checked_in_at);
		return date.toLocaleString();
	});

	// Download QR code
	function downloadQRCode() {
		if (!qrCodeDataUrl) return;

		const link = document.createElement('a');
		link.download = `ticket-${ticket.id}.png`;
		link.href = qrCodeDataUrl;
		link.click();
	}

	// Check if ticket is pending and payment method allows resume
	let canResumePayment = $derived.by(() => {
		if (!ticket) return false;
		if (ticket.status !== 'pending') return false;
		if (!ticket.tier) return false;
		if (!ticket.payment?.id) return false; // Need payment ID

		const paymentMethod = ticket.tier.payment_method;
		// Only allow resume for online (Stripe) payments
		// Offline and at-the-door payments require manual completion
		return paymentMethod === 'online';
	});

	// Check if ticket reservation can be cancelled (has pending online payment)
	let canCancelReservation = $derived.by(() => {
		if (!ticket) return false;
		if (ticket.status !== 'pending') return false;
		if (!ticket.payment?.id) return false;
		// Only allow cancel for online payments (pending Stripe checkout)
		return ticket.tier?.payment_method === 'online';
	});

	// Format seat information
	// Venue/sector come from ticket.tier, seat info comes from ticket.seat
	let seatInfo = $derived.by(() => {
		if (!ticket) return null;
		const parts: string[] = [];

		// Add venue if available (from tier)
		if (ticket.tier?.venue?.name) {
			parts.push(ticket.tier.venue.name);
		}

		// Add sector if available (from tier)
		if (ticket.tier?.sector?.name) {
			parts.push(ticket.tier.sector.name);
		}

		// Build seat details (from ticket.seat)
		const seatDetails: string[] = [];
		if (ticket.seat?.row) {
			seatDetails.push(`Row ${ticket.seat.row}`);
		}
		if (ticket.seat?.number !== null && ticket.seat?.number !== undefined) {
			seatDetails.push(`Seat ${ticket.seat.number}`);
		}
		if (ticket.seat?.label && seatDetails.length === 0) {
			// Use seat_label only if no row/number info
			seatDetails.push(ticket.seat.label);
		}

		if (seatDetails.length > 0) {
			parts.push(seatDetails.join(', '));
		}

		return parts.length > 0 ? parts.join(' • ') : null;
	});

	// Check if ticket has any seat info to display
	let hasSeatInfo = $derived(
		!!(
			ticket?.tier?.venue?.name ||
			ticket?.tier?.sector?.name ||
			ticket?.seat?.label ||
			ticket?.seat?.row ||
			(ticket?.seat?.number !== null && ticket?.seat?.number !== undefined)
		)
	);

	// Group pending tickets by payment ID for online payments
	interface PaymentGroup {
		paymentId: string;
		tickets: UserTicketSchema[];
		isOnline: boolean;
	}

	let pendingPaymentGroups = $derived.by((): PaymentGroup[] => {
		const groups = new Map<string, UserTicketSchema[]>();

		for (const t of ticketArray) {
			if (t.status === 'pending' && t.payment?.id && t.tier?.payment_method === 'online') {
				const paymentId = t.payment.id;
				if (!groups.has(paymentId)) {
					groups.set(paymentId, []);
				}
				groups.get(paymentId)!.push(t);
			}
		}

		return Array.from(groups.entries()).map(([paymentId, tickets]) => ({
			paymentId,
			tickets,
			isOnline: true
		}));
	});

	// Check if current ticket is part of a pending payment group
	let currentTicketPaymentGroup = $derived.by((): PaymentGroup | null => {
		if (!ticket?.payment?.id) return null;
		return pendingPaymentGroups.find((g) => g.paymentId === ticket.payment?.id) ?? null;
	});

	// Count of active (non-cancelled, non-pending) tickets
	let activeTicketCount = $derived(
		ticketArray.filter((t) => t.status === 'active' || t.status === 'checked_in').length
	);

	// Count of pending tickets
	let pendingTicketCount = $derived(ticketArray.filter((t) => t.status === 'pending').length);
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="sr-only">{m['myTicketModal.yourTicket']()}</DialogTitle>
		</DialogHeader>

		{#if !ticket}
			<div class="py-8 text-center text-muted-foreground">No ticket data available.</div>
		{:else}
			<div class="space-y-6">
				<!-- Ticket Summary (when there are multiple tickets or pending payments) -->
				{#if hasMultipleTickets || pendingPaymentGroups.length > 0}
					<div class="rounded-lg border border-border bg-muted/30 p-3">
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							{#if activeTicketCount > 0}
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-green-500"></span>
									<span>{activeTicketCount} active</span>
								</span>
							{/if}
							{#if pendingTicketCount > 0}
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-orange-500"></span>
									<span>{pendingTicketCount} pending payment</span>
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Multi-ticket navigation -->
				{#if hasMultipleTickets}
					<div
						class="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2"
					>
						<Button
							variant="ghost"
							size="sm"
							onclick={goToPrevious}
							disabled={currentIndex === 0}
							aria-label="Previous ticket"
						>
							<ChevronLeft class="h-4 w-4" />
						</Button>
						<span class="text-sm font-medium">
							{m['myTicketModal.ticketOf']?.({ current: currentIndex + 1, total: totalTickets }) ??
								`Ticket ${currentIndex + 1} of ${totalTickets}`}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onclick={goToNext}
							disabled={currentIndex === totalTickets - 1}
							aria-label="Next ticket"
						>
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}

				<!-- Header -->
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-primary/10 p-3">
							<Ticket class="h-6 w-6 text-primary" aria-hidden="true" />
						</div>
						<div>
							<h2 class="text-xl font-bold">{eventName}</h2>
							<p class="text-sm text-muted-foreground">
								{ticket.tier?.name || 'General Admission'}
							</p>
						</div>
					</div>
					<TicketStatusBadge status={ticket.status} />
				</div>

				<!-- Ticket Holder & Seat Info -->
				{#if ticket.guest_name || hasSeatInfo}
					<dl class="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
						{#if ticket.guest_name}
							<div class="flex items-center gap-2">
								<dt class="sr-only">Ticket Holder</dt>
								<User class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd class="font-medium">{ticket.guest_name}</dd>
							</div>
						{/if}
						{#if seatInfo}
							<div class="flex items-center gap-2">
								<dt class="sr-only">Seat</dt>
								<Armchair class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd>{seatInfo}</dd>
							</div>
						{/if}
					</dl>
				{/if}

				<!-- Pending Payment Banner -->
				{#if ticket.status === 'pending'}
					{@const paymentGroup = currentTicketPaymentGroup}
					{@const ticketsInGroup = paymentGroup?.tickets.length ?? 1}
					<div
						class="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950"
						role="alert"
					>
						<div class="flex items-start gap-3">
							<svg
								class="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400"
								fill="currentColor"
								viewBox="0 0 20 20"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
									clip-rule="evenodd"
								/>
							</svg>
							<div class="flex-1">
								<p class="font-medium text-orange-900 dark:text-orange-100">
									{#if ticketsInGroup > 1}
										{ticketsInGroup} tickets pending payment
									{:else}
										Your ticket is pending payment
									{/if}
								</p>
								<p class="mt-1 text-sm text-orange-800 dark:text-orange-200">
									{#if ticket.tier?.payment_method === 'online'}
										Complete your payment to confirm {ticketsInGroup > 1
											? 'your tickets'
											: 'your ticket'}. Your reservation will expire if payment is not completed.
									{:else if ticket.tier?.payment_method === 'offline'}
										Please complete your offline payment as instructed by the organizer to confirm
										{ticketsInGroup > 1 ? 'your tickets' : 'your ticket'}.
									{:else}
										Complete your payment to confirm {ticketsInGroup > 1
											? 'your tickets'
											: 'your ticket'}.
									{/if}
								</p>

								<!-- Manual Payment Instructions -->
								{#if ticket.tier?.payment_method !== 'online' && ticket.tier?.manual_payment_instructions}
									<div
										class="mt-3 rounded-md border border-orange-300 bg-orange-100 p-3 dark:border-orange-700 dark:bg-orange-900"
									>
										<p class="text-sm font-medium text-orange-900 dark:text-orange-100">
											Payment Instructions:
										</p>
										<MarkdownContent
											content={ticket.tier.manual_payment_instructions}
											class="mt-1 text-sm text-orange-800 dark:text-orange-200"
										/>
									</div>
								{/if}

								<!-- Action Buttons for Online Payments -->
								{#if canResumePayment && ticket.payment?.id}
									{@const paymentId = ticket.payment.id}
									<div class="mt-3 flex flex-wrap gap-2">
										{#if onResumePayment}
											<button
												onclick={() => onResumePayment(paymentId)}
												disabled={isResumingPayment || isCancellingReservation}
												class="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
											>
												{#if isResumingPayment}
													<div
														class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
														aria-hidden="true"
													></div>
													Processing...
												{:else}
													Resume Payment
												{/if}
											</button>
										{/if}
										{#if onCancelReservation}
											<button
												onclick={() => onCancelReservation(paymentId)}
												disabled={isResumingPayment || isCancellingReservation}
												class="inline-flex items-center gap-2 rounded-md border border-orange-300 bg-transparent px-4 py-2 text-sm font-medium text-orange-700 shadow-sm hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/50"
											>
												{#if isCancellingReservation}
													<div
														class="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent dark:border-orange-400"
														aria-hidden="true"
													></div>
													Cancelling...
												{:else}
													<X class="h-4 w-4" aria-hidden="true" />
													Cancel Reservation
												{/if}
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Event Details -->
				{#if eventDate || eventLocation}
					<dl class="space-y-2 text-sm">
						{#if eventDate}
							<div class="flex items-center gap-2">
								<Calendar class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd>{eventDate}</dd>
							</div>
						{/if}
						{#if eventLocation}
							<div class="flex items-center gap-2">
								<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd>{eventLocation}</dd>
							</div>
						{/if}
					</dl>
				{/if}

				<!-- QR Code -->
				{#if ticket.status === 'pending' || ticket.status === 'active' || ticket.status === 'checked_in'}
					<div
						class="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6"
					>
						{#if isGenerating}
							<div class="flex h-64 w-64 items-center justify-center">
								<div
									class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"
									role="status"
									aria-label="Generating QR code"
								></div>
							</div>
						{:else if qrCodeDataUrl}
							<img
								src={qrCodeDataUrl}
								alt="Ticket QR Code"
								class="h-64 w-64 rounded-lg border border-border bg-white"
							/>
							<p class="text-center text-sm text-muted-foreground">{m['myTicketModal.showQr']()}</p>
							<div class="flex w-full flex-col gap-2">
								<button
									type="button"
									onclick={downloadQRCode}
									class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
								>
									<Download class="h-4 w-4" aria-hidden="true" />
									Download QR Code
								</button>
								{#if ticket.apple_pass_available && ticket.id}
									<AddToWalletButton ticketId={ticket.id} {eventName} variant="secondary" />
								{/if}
							</div>
						{:else}
							<div class="text-center text-sm text-destructive">
								Unable to generate QR code. Please refresh the page.
							</div>
						{/if}
					</div>
				{/if}

				<!-- Checked In Info -->
				{#if ticket.status === 'checked_in' && checkedInDate}
					<div class="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-950/50">
						<p class="font-medium text-blue-900 dark:text-blue-100">
							Checked in at {checkedInDate}
						</p>
					</div>
				{/if}

				<!-- Ticket ID -->
				<div class="border-t border-border pt-4">
					<p class="text-xs text-muted-foreground">{m['myTicketModal.ticketId']()} {ticket.id}</p>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
