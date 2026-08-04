<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { UserTicketSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import AddToWalletButton from './AddToWalletButton.svelte';
	import DownloadPdfButton from './DownloadPdfButton.svelte';
	import CancelTicketDialog from './CancelTicketDialog.svelte';
	import RenameTicketHolderDialog from './RenameTicketHolderDialog.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import {
		Ticket,
		Calendar,
		MapPin,
		User,
		Armchair,
		Banknote,
		ChevronLeft,
		ChevronRight,
		Pencil,
		X,
		AlertCircle
	} from '@lucide/svelte';
	import { formatMoney } from '$lib/utils/format';
	import QRCode from 'qrcode';
	import { formatDateTime } from '$lib/utils/date';
	import { authStore } from '$lib/stores/auth.svelte';

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
		/** Called after a ticket is successfully cancelled — parent should refresh data. */
		onTicketCancelled?: () => void;
		/** Called after the ticket holder name is changed — parent should refresh data. */
		onTicketRenamed?: () => void;
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
		isCancellingReservation = false,
		onTicketCancelled,
		onTicketRenamed
	}: Props = $props();

	let showCancelDialog = $state(false);
	let ticketIdToCancel = $state<string | null>(null);

	// Normalize to array and filter out undefined/null values
	const ticketArray = $derived(
		(Array.isArray(tickets) ? tickets : [tickets]).filter((t): t is UserTicketSchema => t != null)
	);
	const totalTickets = $derived(ticketArray.length);
	const hasMultipleTickets = $derived(totalTickets > 1);

	// Current ticket index for navigation
	let currentIndex = $state(0);

	// Current ticket being displayed - with guard for empty array
	const ticket = $derived(ticketArray[currentIndex] ?? ticketArray[0]);

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
	const checkedInDate = $derived.by(() =>
		ticket?.checked_in_at ? formatDateTime(ticket.checked_in_at) : null
	);

	// Check if ticket is pending and payment method allows resume
	const canResumePayment = $derived.by(() => {
		if (!ticket) return false;
		if (ticket.status !== 'pending') return false;
		if (!ticket.tier) return false;
		if (!ticket.payment?.id) return false; // Need payment ID

		const paymentMethod = ticket.tier.payment_method;
		// Only allow resume for online (Stripe) payments
		// Offline and at-the-door payments require manual completion
		return paymentMethod === 'online';
	});

	// Self-cancellation gate: ticket is active, the tier opted in, and the event
	// hasn't started. The preview endpoint is still the source of truth for
	// edge cases (past deadline, etc.) and surfaces them inside the dialog.
	const canSelfCancel = $derived.by(() => {
		if (!ticket?.id) return false;
		if (ticket.status !== 'active') return false;
		if (!ticket.tier?.allow_user_cancellation) return false;
		if (ticket.event?.start) {
			const startMs = new Date(ticket.event.start).getTime();
			if (Number.isFinite(startMs) && startMs <= Date.now()) return false;
		}
		return true;
	});

	// Rename gate: the backend 409s once checked-in or cancelled.
	const canRenameHolder = $derived.by(() => {
		if (!ticket?.id) return false;
		return ticket.status !== 'checked_in' && ticket.status !== 'cancelled';
	});

	let showRenameDialog = $state(false);

	function openCancelDialog(): void {
		if (!ticket?.id) return;
		ticketIdToCancel = ticket.id;
		showCancelDialog = true;
	}

	function handleTicketCancelled(): void {
		showCancelDialog = false;
		ticketIdToCancel = null;
		onTicketCancelled?.();
	}

	// Format seat information
	// Venue/sector come from ticket.tier, seat info comes from ticket.seat
	const seatInfo = $derived.by(() => {
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
		// Prefer row_label; fall back to the transitional `row` alias while it still exists
		const seatRow = ticket.seat?.row_label ?? ticket.seat?.row;
		const seatDetails: string[] = [];
		if (seatRow) {
			seatDetails.push(m['myTicketModal.rowLabel']({ row: seatRow }));
		}
		if (ticket.seat?.number !== null && ticket.seat?.number !== undefined) {
			seatDetails.push(m['myTicketModal.seatLabel']({ number: ticket.seat.number }));
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
	const hasSeatInfo = $derived(
		!!(
			ticket?.tier?.venue?.name ||
			ticket?.tier?.sector?.name ||
			ticket?.seat?.label ||
			(ticket?.seat?.row_label ?? ticket?.seat?.row) ||
			(ticket?.seat?.number !== null && ticket?.seat?.number !== undefined)
		)
	);

	// Per-ticket amount (#668): with per-seat-category pricing two tickets on
	// the same tier can cost different amounts, and offline/at-the-door tickets
	// issue with no confirmation screen — this row is where the buyer learns
	// what THIS seat costs. Hidden at 0 so free tickets stay uncluttered.
	const pricePaidDisplay = $derived.by(() => {
		if (ticket?.price_paid == null) return null;
		const parsed = Number.parseFloat(ticket.price_paid);
		if (!Number.isFinite(parsed) || parsed <= 0) return null;
		return formatMoney(ticket.price_paid, ticket.tier?.currency);
	});

	// Group pending tickets by payment ID for online payments
	interface PaymentGroup {
		paymentId: string;
		tickets: UserTicketSchema[];
		isOnline: boolean;
	}

	const pendingPaymentGroups = $derived.by((): PaymentGroup[] => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local grouping map built and consumed synchronously within this $derived.by computation, never stored
		const groups = new Map<string, UserTicketSchema[]>();

		for (const t of ticketArray) {
			if (t.status === 'pending' && t.payment?.id && t.tier?.payment_method === 'online') {
				const paymentId = t.payment.id;
				let group = groups.get(paymentId);
				if (!group) {
					group = [];
					groups.set(paymentId, group);
				}
				group.push(t);
			}
		}

		return Array.from(groups.entries()).map(([paymentId, tickets]) => ({
			paymentId,
			tickets,
			isOnline: true
		}));
	});

	// Check if current ticket is part of a pending payment group
	const currentTicketPaymentGroup = $derived.by((): PaymentGroup | null => {
		if (!ticket?.payment?.id) return null;
		return pendingPaymentGroups.find((g) => g.paymentId === ticket.payment?.id) ?? null;
	});

	// Count of active (non-cancelled, non-pending) tickets
	const activeTicketCount = $derived(
		ticketArray.filter((t) => t.status === 'active' || t.status === 'checked_in').length
	);

	// Count of pending tickets
	const pendingTicketCount = $derived(ticketArray.filter((t) => t.status === 'pending').length);
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="sr-only">{m['myTicketModal.yourTicket']()}</DialogTitle>
		</DialogHeader>

		{#if !ticket}
			<div class="py-8 text-center text-muted-foreground">
				{m['myTicketModal.noTicketData']()}
			</div>
		{:else}
			<div class="space-y-6">
				<!-- Ticket Summary (when there are multiple tickets or pending payments) -->
				{#if hasMultipleTickets || pendingPaymentGroups.length > 0}
					<div class="rounded-lg border border-border bg-muted/30 p-3">
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							{#if activeTicketCount > 0}
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-success"></span>
									<span>{m['myTicketModal.activeCount']({ count: activeTicketCount })}</span>
								</span>
							{/if}
							{#if pendingTicketCount > 0}
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-highlight"></span>
									<span>{m['myTicketModal.pendingCount']({ count: pendingTicketCount })}</span>
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
							aria-label={m['myTicketModal.previousTicket']()}
						>
							<ChevronLeft class="h-4 w-4" />
						</Button>
						<span class="text-sm font-medium">
							{m['myTicketModal.ticketOf']({ current: currentIndex + 1, total: totalTickets })}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onclick={goToNext}
							disabled={currentIndex === totalTickets - 1}
							aria-label={m['myTicketModal.nextTicket']()}
						>
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}

				<!-- Header band — the brand moment (what people screenshot at the door).
				     On the logo gradient (--logo-from -> --logo-to, the same pair
				     RevelMark uses); inset (not bled to the dialog edge) so it never
				     collides with the dialog's close button. Only large/bold text and
				     icons sit on the gradient: white on the purple end measures
				     ~5.5:1, white on the crimson end ~4.3:1 — that clears the WCAG AA
				     *large-text* floor (3:1) at both ends but not the 4.5:1
				     normal-text floor, so smaller metadata (tier name, status) stays
				     off the gradient, on the dialog surface below. -->
				<div
					class="flex items-center gap-3 rounded-lg px-5 py-4"
					style="background: linear-gradient(135deg, hsl(var(--logo-from)), hsl(var(--logo-to)));"
				>
					<Ticket class="h-6 w-6 shrink-0 text-poster-white" aria-hidden="true" />
					<h2 class="text-xl font-black leading-tight text-poster-white">{eventName}</h2>
				</div>
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
						{ticket.tier?.name || m['myTicketModal.generalAdmission']()}
					</p>
					<TicketStatusBadge status={ticket.status} />
				</div>

				<!-- Ticket Holder & Seat Info -->
				{#if ticket.guest_name || canRenameHolder || hasSeatInfo || pricePaidDisplay}
					<dl class="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
						{#if ticket.guest_name || canRenameHolder}
							<div class="flex items-center gap-2">
								<dt class="sr-only">{m['myTicketModal.ticketHolder']()}</dt>
								<User class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<!-- A <dd> always follows the <dt>: a nameless-but-renamable
								     ticket still needs a description for the term. -->
								<dd class="flex items-center gap-2">
									{#if ticket.guest_name}
										<span class="font-medium">{ticket.guest_name}</span>
									{/if}
									{#if canRenameHolder}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="h-7 px-2 text-xs"
											onclick={() => (showRenameDialog = true)}
										>
											<Pencil class="mr-1 h-3 w-3" aria-hidden="true" />
											{ticket.guest_name
												? m['myTicketModal.renameHolder']()
												: m['myTicketModal.addHolderName']()}
										</Button>
									{/if}
								</dd>
							</div>
						{/if}
						{#if seatInfo}
							<div class="flex items-center gap-2">
								<dt class="sr-only">{m['myTicketModal.seat']()}</dt>
								<Armchair class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd>{seatInfo}</dd>
							</div>
						{/if}
						{#if pricePaidDisplay}
							<div class="flex items-center gap-2">
								<dt class="sr-only">{m['eventTicketsAdmin.headerPrice']()}</dt>
								<Banknote class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<dd>
									{ticket.status === 'pending'
										? m['myTicket.amountDue']({ amount: pricePaidDisplay })
										: m['myTicket.pricePaid']({ amount: pricePaidDisplay })}
								</dd>
							</div>
						{/if}
					</dl>
				{/if}

				<!-- Pending Payment Banner. Tint/text pair mirrors ToneTile's audited
				     warning tokens (bg-highlight/20, text-highlight-foreground light /
				     text-highlight dark — see ToneTile.svelte for the hand-verified
				     ratios: 12.6:1 light, 6.7:1 dark). -->
				{#if ticket.status === 'pending'}
					{@const paymentGroup = currentTicketPaymentGroup}
					{@const ticketsInGroup = paymentGroup?.tickets.length ?? 1}
					<div class="rounded-lg border border-highlight/40 bg-highlight/20 p-4" role="alert">
						<div class="flex items-start gap-3">
							<AlertCircle
								class="h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
								aria-hidden="true"
							/>
							<div class="flex-1">
								<p class="font-bold text-highlight-foreground dark:text-highlight">
									{#if ticketsInGroup > 1}
										{m['myTicketModal.ticketsPendingPayment']({ count: ticketsInGroup })}
									{:else}
										{m['myTicketModal.pendingPayment']()}
									{/if}
								</p>
								<p class="mt-1 text-sm text-highlight-foreground dark:text-highlight">
									{#if ticket.tier?.payment_method === 'online'}
										{ticketsInGroup > 1
											? m['myTicketModal.pendingOnlinePlural']()
											: m['myTicketModal.pendingOnline']()}
									{:else if ticket.tier?.payment_method === 'offline'}
										{ticketsInGroup > 1
											? m['myTicketModal.pendingOfflinePlural']()
											: m['myTicketModal.pendingOffline']()}
									{:else}
										{ticketsInGroup > 1
											? m['myTicketModal.pendingGenericPlural']()
											: m['myTicketModal.pendingGeneric']()}
									{/if}
								</p>

								<!-- Manual Payment Instructions -->
								{#if ticket.tier?.payment_method !== 'online' && ticket.tier?.manual_payment_instructions}
									<div class="mt-3 rounded-md border border-highlight/40 bg-card p-3">
										<p class="text-sm font-bold text-foreground">
											{m['myTicketModal.paymentInstructions']()}
										</p>
										<MarkdownContent
											content={ticket.tier.manual_payment_instructions}
											class="mt-1 text-sm text-muted-foreground"
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
												class="inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-highlight-foreground shadow-sm hover:bg-highlight/90 focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											>
												{#if isResumingPayment}
													<div
														class="h-4 w-4 animate-spin rounded-full border-2 border-highlight-foreground border-t-transparent"
														aria-hidden="true"
													></div>
													{m['myTicketModal.processing']()}
												{:else}
													{m['myTicketModal.resumePayment']()}
												{/if}
											</button>
										{/if}
										{#if onCancelReservation}
											<button
												onclick={() => onCancelReservation(paymentId)}
												disabled={isResumingPayment || isCancellingReservation}
												class="inline-flex items-center gap-2 rounded-md border border-highlight/60 bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-highlight/10 focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											>
												{#if isCancellingReservation}
													<div
														class="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent"
														aria-hidden="true"
													></div>
													{m['myTicketModal.cancelling']()}
												{:else}
													<X class="h-4 w-4" aria-hidden="true" />
													{m['myTicketModal.cancelReservation']()}
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
									aria-label={m['myTicketModal.generatingQr']()}
								></div>
							</div>
						{:else if qrCodeDataUrl}
							<img
								src={qrCodeDataUrl}
								alt={m['myTicketModal.qrAlt']()}
								class="h-64 w-64 rounded-lg border border-border bg-white"
							/>
							<p class="text-center text-sm text-muted-foreground">{m['myTicketModal.showQr']()}</p>
							<div class="flex w-full flex-col gap-2">
								{#if ticket.id}
									<DownloadPdfButton ticketId={ticket.id} pdfUrl={ticket.pdf_url} />
								{/if}
								{#if ticket.apple_pass_available && ticket.id}
									<AddToWalletButton ticketId={ticket.id} {eventName} variant="secondary" />
								{/if}
							</div>
						{:else}
							<div class="text-center text-sm text-destructive">
								{m['myTicketModal.qrError']()}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Checked In Info. bg-info/10 + text-info mirrors ToneTile's audited
				     info tokens (hand-verified 8.3:1 light / 8.0:1 dark — see
				     ToneTile.svelte). -->
				{#if ticket.status === 'checked_in' && checkedInDate}
					<div class="rounded-lg bg-info/10 p-4 text-sm">
						<p class="font-bold text-info">
							{m['myTicketModal.checkedInAt']({ date: checkedInDate })}
						</p>
					</div>
				{/if}

				<!-- Cancelled banner -->
				{#if ticket.status === 'cancelled'}
					<div class="rounded-lg border border-border bg-muted/50 p-4 text-sm" role="status">
						<p class="font-medium text-foreground">
							{m['cancelTicket.cancelledBanner.genericTitle']()}
						</p>
					</div>
				{/if}

				<!-- Self-cancel action -->
				{#if canSelfCancel}
					<div class="border-t border-border pt-4">
						<Button
							type="button"
							variant="outline"
							class="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
							onclick={openCancelDialog}
						>
							<X class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['cancelTicket.button']()}
						</Button>
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

{#if ticketIdToCancel}
	<CancelTicketDialog
		bind:open={showCancelDialog}
		ticketId={ticketIdToCancel}
		onCancelled={handleTicketCancelled}
	/>
{/if}

{#if ticket?.id}
	<RenameTicketHolderDialog
		open={showRenameDialog}
		ticketId={ticket.id}
		currentName={ticket.guest_name ?? ''}
		accessToken={authStore.accessToken}
		onClose={() => (showRenameDialog = false)}
		onRenamed={() => onTicketRenamed?.()}
	/>
{/if}
