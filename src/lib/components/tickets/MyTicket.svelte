<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import DownloadPdfButton from './DownloadPdfButton.svelte';
	import { Ticket, Calendar, MapPin, User, Armchair, Banknote, AlertCircle } from '@lucide/svelte';
	import { formatDateTime } from '$lib/utils/date';
	import { formatMoney } from '$lib/utils/format';
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

	const {
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
	const checkedInDate = $derived(
		ticket.checked_in_at ? formatDateTime(ticket.checked_in_at) : null
	);

	// Check if ticket is pending and payment method allows resume
	const canResumePayment = $derived(() => {
		if (ticket.status !== 'pending') return false;
		if (!ticket.tier) return false;

		const paymentMethod = ticket.tier.payment_method;
		// Only allow resume for online (Stripe) payments
		// Offline and at-the-door payments require manual completion
		return paymentMethod === 'online';
	});

	// Format seat information
	// Venue/sector come from ticket.tier, seat info comes from ticket.seat
	const seatInfo = $derived.by(() => {
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
		// Prefer row_label; fall back to the transitional `row` alias while it still exists
		const seatRow = ticket.seat?.row_label ?? ticket.seat?.row;
		const seatDetails: string[] = [];
		if (seatRow) {
			seatDetails.push(m['myTicket.rowLabel']({ row: seatRow }));
		}
		if (ticket.seat?.number !== null && ticket.seat?.number !== undefined) {
			seatDetails.push(m['myTicket.seatLabel']({ number: ticket.seat.number }));
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

	// Per-ticket amount (#668): with per-seat-category pricing two tickets on
	// the same tier can cost different amounts, and offline/at-the-door tickets
	// issue with no confirmation screen — this line is where the buyer learns
	// what THIS seat costs. Hidden at 0 so free tickets stay uncluttered.
	const pricePaidDisplay = $derived.by(() => {
		if (ticket.price_paid == null) return null;
		const parsed = Number.parseFloat(ticket.price_paid);
		if (!Number.isFinite(parsed) || parsed <= 0) return null;
		return formatMoney(ticket.price_paid, ticket.tier?.currency);
	});

	// Check if ticket has any seat info to display
	const hasSeatInfo = $derived(
		!!(
			ticket.tier?.venue?.name ||
			ticket.tier?.sector?.name ||
			ticket.seat?.label ||
			(ticket.seat?.row_label ?? ticket.seat?.row) ||
			(ticket.seat?.number !== null && ticket.seat?.number !== undefined)
		)
	);
</script>

<Card class="overflow-hidden p-6">
	<div class="space-y-6">
		<!-- Header band — the brand moment (what people screenshot at the door).
		     Bleeds to the card edges on the logo gradient (--logo-from -> --logo-to,
		     the same pair RevelMark uses). NOTE: --logo-from/--logo-to are already
		     COMPLETE hsl(...) values (see app.css) — do not wrap them in another
		     hsl() (see RevelMark.svelte:36 for the correct var()-only usage); doing
		     so produces hsl(hsl(...)), an invalid value that drops the whole
		     declaration and leaves the band transparent. Only large/bold text and
		     icons sit on the gradient: white on the purple end measures ~5.5:1,
		     white on the crimson end ~4.3:1 — that clears the WCAG AA *large-text*
		     floor (3:1) at both ends but NOT the 4.5:1 normal-text floor. Do not
		     shrink this text below the large-text threshold (effectively
		     `font-black`/`sm:text-3xl` here). Smaller metadata (tier name, status)
		     stays off the gradient, on the card surface below. -->
		<div
			class="-mx-6 -mt-6 flex items-center gap-3 rounded-t-lg px-6 py-5"
			style="background: linear-gradient(135deg, var(--logo-from), var(--logo-to));"
		>
			<Ticket class="h-7 w-7 shrink-0 text-poster-white" aria-hidden="true" />
			<h2 class="text-2xl font-black leading-[1.12] text-poster-white sm:text-3xl">{eventName}</h2>
		</div>
		<div class="flex items-start justify-between gap-2">
			<p class="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
				{ticket.tier?.name || m['myTicket.generalAdmission']()}
			</p>
			<TicketStatusBadge status={ticket.status} />
		</div>

		<!-- Ticket Holder & Seat Info -->
		{#if ticket.guest_name || hasSeatInfo || pricePaidDisplay}
			<ul class="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
				{#if ticket.guest_name}
					<li class="flex items-center gap-2">
						<span class="sr-only">{m['myTicket.ticketHolder']()}</span>
						<User class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						<span class="font-medium">{ticket.guest_name}</span>
					</li>
				{/if}
				{#if seatInfo}
					<li class="flex items-center gap-2">
						<span class="sr-only">{m['myTicket.seat']()}</span>
						<Armchair class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						<span>{seatInfo}</span>
					</li>
				{/if}
				{#if pricePaidDisplay}
					<li class="flex items-center gap-2">
						<Banknote class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						<span>
							{ticket.status === 'pending'
								? m['myTicket.amountDue']({ amount: pricePaidDisplay })
								: m['myTicket.pricePaid']({ amount: pricePaidDisplay })}
						</span>
					</li>
				{/if}
			</ul>
		{/if}

		<!-- Pending Payment Banner. Tint/text pair mirrors ToneTile's audited
		     warning tokens (bg-highlight/20, text-highlight-foreground light /
		     text-highlight dark). Hand-verified on THIS surface (bg-highlight/20
		     composited over --card, the Card this banner sits in): 13.93:1 light,
		     5.96:1 dark. Recompute if this banner is ever moved onto a different
		     surface (ToneTile.svelte's own comment is for its icon tile on
		     page/card, not this banner). -->
		{#if ticket.status === 'pending'}
			<div class="rounded-lg border border-highlight/40 bg-highlight/20 p-4" role="alert">
				<div class="flex items-start gap-3">
					<AlertCircle
						class="h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
						aria-hidden="true"
					/>
					<div class="flex-1">
						<p class="font-bold text-highlight-foreground dark:text-highlight">
							{m['myTicket.pendingPayment']()}
						</p>
						<p class="mt-1 text-sm text-highlight-foreground dark:text-highlight">
							{#if ticket.tier?.payment_method === 'online'}
								{m['myTicket.pendingOnline']()}
							{:else if ticket.tier?.payment_method === 'offline'}
								{m['myTicket.pendingOffline']()}
							{:else}
								{m['myTicket.pendingGeneric']()}
							{/if}
						</p>

						<!-- Manual Payment Instructions -->
						{#if ticket.tier?.payment_method !== 'online' && ticket.tier?.manual_payment_instructions}
							<div class="mt-3 rounded-md border border-highlight/40 bg-card p-3">
								<p class="text-sm font-bold text-foreground">
									{m['myTicket.paymentInstructions']()}
								</p>
								<MarkdownContent
									content={ticket.tier.manual_payment_instructions}
									class="mt-1 text-sm text-muted-foreground"
								/>
							</div>
						{/if}

						{#if canResumePayment() && onResumePayment}
							<button
								onclick={onResumePayment}
								disabled={isResumingPayment}
								class="mt-3 inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-highlight-foreground shadow-sm hover:bg-highlight/90 focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if isResumingPayment}
									<div
										class="h-4 w-4 animate-spin rounded-full border-2 border-highlight-foreground border-t-transparent"
										aria-hidden="true"
									></div>
									{m['myTicket.processing']()}
								{:else}
									{m['myTicket.resumePayment']()}
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Event Details -->
		{#if eventDate || eventLocation}
			<ul class="space-y-2 text-sm">
				{#if eventDate}
					<li class="flex items-center gap-2">
						<Calendar class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						<span>{eventDate}</span>
					</li>
				{/if}
				{#if eventLocation}
					<li class="flex items-center gap-2">
						<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						<span>{eventLocation}</span>
					</li>
				{/if}
			</ul>
		{/if}

		<!-- QR Code -->
		{#if ticket.status === 'active' || ticket.status === 'checked_in'}
			<div class="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6">
				{#if isGenerating}
					<div class="flex h-64 w-64 items-center justify-center">
						<div
							class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"
							role="status"
							aria-label={m['myTicket.generatingQr']()}
						></div>
					</div>
				{:else if qrCodeDataUrl}
					<img
						src={qrCodeDataUrl}
						alt={m['myTicket.qrAlt']()}
						class="h-64 w-64 rounded-lg border border-border bg-white"
					/>
					<p class="text-center text-sm text-muted-foreground">{m['myTicket.showQr']()}</p>
					{#if ticket.id}
						<DownloadPdfButton ticketId={ticket.id} pdfUrl={ticket.pdf_url} />
					{/if}
				{:else}
					<div class="text-center text-sm text-destructive">
						{m['myTicket.qrError']()}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Checked In Info. bg-info/10 + text-info mirrors ToneTile's audited
		     info tokens. Hand-verified on THIS surface (bg-info/10 composited over
		     --card, the Card this banner sits in): 9.31:1 light, 7.15:1 dark. -->
		{#if ticket.status === 'checked_in' && checkedInDate}
			<div class="rounded-lg bg-info/10 p-4 text-sm">
				<p class="font-bold text-info">{m['myTicket.checkedInAt']()} {checkedInDate}</p>
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
						{m['myTicket.viewAllTickets']({ count: totalTickets })}
					{:else}
						{m['myTicket.viewTicketDetails']()}
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
