<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { Ticket, Calendar, MapPin, Download, User, Armchair } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	interface Props {
		ticket: EventTicketSchemaActual;
		eventName: string;
		eventDate?: string;
		eventLocation?: string;
		onResumePayment?: () => void;
		isResumingPayment?: boolean;
		/** Total number of tickets the user has */
		totalTickets?: number;
		/** Callback to open the full ticket modal */
		onViewAllTickets?: () => void;
	}

	let {
		ticket,
		eventName,
		eventDate,
		eventLocation,
		onResumePayment,
		isResumingPayment = false,
		totalTickets = 1,
		onViewAllTickets
	}: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);
	let isGenerating = $state(false);

	// Generate QR code on mount
	onMount(async () => {
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
	});

	// Format checked in date
	let checkedInDate = $derived(() => {
		if (!ticket.checked_in_at) return null;
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
	let canResumePayment = $derived(() => {
		if (ticket.status !== 'pending') return false;
		if (!ticket.tier) return false;

		const paymentMethod = ticket.tier.payment_method;
		// Only allow resume for online (Stripe) payments
		// Offline and at-the-door payments require manual completion
		return paymentMethod === 'online';
	});

	// Format seat information
	// Venue/sector come from ticket.tier, seat info comes from ticket.seat
	let seatInfo = $derived.by(() => {
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
			ticket.tier?.venue?.name ||
			ticket.tier?.sector?.name ||
			ticket.seat?.label ||
			ticket.seat?.row ||
			(ticket.seat?.number !== null && ticket.seat?.number !== undefined)
		)
	);
</script>

<Card class="p-6">
	<div class="space-y-6">
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
							Your ticket is pending payment
						</p>
						<p class="mt-1 text-sm text-orange-800 dark:text-orange-200">
							{#if ticket.tier?.payment_method === 'online'}
								Complete your payment to confirm your ticket. Your reservation will expire if
								payment is not completed.
							{:else if ticket.tier?.payment_method === 'offline'}
								Please complete your offline payment as instructed by the organizer to confirm your
								ticket.
							{:else}
								Complete your payment to confirm your ticket.
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

						{#if canResumePayment() && onResumePayment}
							<button
								onclick={onResumePayment}
								disabled={isResumingPayment}
								class="mt-3 inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
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
		{#if ticket.status === 'active' || ticket.status === 'checked_in'}
			<div class="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6">
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
					<p class="text-center text-sm text-muted-foreground">{m['myTicket.showQr']()}</p>
					<button
						onclick={downloadQRCode}
						class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
					>
						<Download class="h-4 w-4" aria-hidden="true" />
						Download QR Code
					</button>
				{:else}
					<div class="text-center text-sm text-destructive">
						Unable to generate QR code. Please refresh the page.
					</div>
				{/if}
			</div>
		{/if}

		<!-- Checked In Info -->
		{#if ticket.status === 'checked_in' && checkedInDate()}
			<div class="rounded-lg bg-blue-50 p-4 text-sm">
				<p class="font-medium text-blue-900">{m['myTicket.checkedInAt']()} {checkedInDate()}</p>
			</div>
		{/if}

		<!-- View All Tickets Button -->
		{#if onViewAllTickets}
			<div class="border-t border-border pt-4">
				<button
					onclick={onViewAllTickets}
					class="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<Ticket class="h-4 w-4" aria-hidden="true" />
					{#if totalTickets > 1}
						View All {totalTickets} Tickets
					{:else}
						View Ticket Details
					{/if}
				</button>
			</div>
		{/if}

		<!-- Ticket ID -->
		<div class="border-t border-border pt-4">
			<p class="text-xs text-muted-foreground">{m['myTicket.ticketId']()} {ticket.id}</p>
		</div>
	</div>
</Card>
