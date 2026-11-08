<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ScanCallout from '$lib/components/checkin/ScanCallout.svelte';
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';
	import { X, TriangleAlert } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { formatMoney, formatPrice } from '$lib/utils/format';
	import {
		getGuestNameIfDifferent,
		getSeatDisplay,
		saleSourceLabel
	} from '$lib/utils/ticket-helpers';

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
		price_type?: string;
		pwyc_min?: string;
		pwyc_max?: string | null;
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

	interface TicketPayment {
		amount?: string | null;
		currency?: string | null;
	}

	interface Ticket {
		id: string;
		status: string;
		user: TicketUser;
		tier?: TicketTier;
		guest_name?: string;
		seat?: TicketSeat;
		/** Sector name from the scan payload (CheckInResponseSchema.sector_name). */
		sector_name?: string;
		price_paid?: string | null;
		payment?: TicketPayment | null;
		/** How the ticket was sold (AdminTicketSchema only; scan payloads omit it). */
		sale_source?: string | null;
		/**
		 * Private staff note, read-only, shown BEFORE confirming. It comes from the
		 * single-ticket GET (AdminTicketDetailSchema, gated server-side to staff who
		 * may check people in); rows from the attendee list don't carry it.
		 */
		private_note?: string | null;
	}

	interface Props {
		isOpen: boolean;
		ticket: Ticket | null;
		needsPaymentConfirmation: boolean;
		onConfirm: (pricePaid?: string) => void;
		onCancel: () => void;
		isLoading?: boolean;
		/**
		 * Check-in failure message shown inline in the dialog. A toast alone is
		 * too transient at the door — the dialog stays open on failure, so the
		 * reason must stay visible with it.
		 */
		errorMessage?: string | null;
	}

	const {
		isOpen,
		ticket,
		needsPaymentConfirmation,
		onConfirm,
		onCancel,
		isLoading = false,
		errorMessage = null
	}: Props = $props();

	// PWYC state
	let pwycPricePaid = $state('');

	/**
	 * Whether this ticket needs a PWYC price input at check-in
	 */
	const needsPwycInput = $derived(
		!!ticket &&
			ticket.tier?.price_type === 'pwyc' &&
			(ticket.tier?.payment_method === 'offline' || ticket.tier?.payment_method === 'at_the_door')
	);

	/**
	 * Whether the confirm button can be clicked
	 */
	const canSubmit = $derived(
		!isLoading && (!needsPwycInput || (pwycPricePaid !== '' && parseFloat(pwycPricePaid) > 0))
	);

	/**
	 * PWYC range warning message
	 */
	const pwycWarning = $derived.by(() => {
		if (!needsPwycInput || !ticket?.tier) return null;
		const num = parseFloat(pwycPricePaid);
		if (isNaN(num) || num <= 0) return null;

		const min = ticket.tier.pwyc_min ? parseFloat(ticket.tier.pwyc_min) : null;
		const max = ticket.tier.pwyc_max ? parseFloat(ticket.tier.pwyc_max) : null;
		const currency = ticket.tier.currency?.toUpperCase() || 'EUR';
		const fmt = (v: number) => formatMoney(v, currency);

		if (min !== null && max !== null && (num < min || num > max)) {
			return m['checkInDialog.pwycOutsideRange']({ min: fmt(min), max: fmt(max) });
		}
		if (min !== null && max === null && num < min) {
			return m['checkInDialog.pwycBelowMin']({ min: fmt(min) });
		}
		return null;
	});

	/**
	 * PWYC suggested range hint text
	 */
	const pwycRangeHint = $derived.by(() => {
		if (!needsPwycInput || !ticket?.tier) return null;
		const min = ticket.tier.pwyc_min ? parseFloat(ticket.tier.pwyc_min) : null;
		const max = ticket.tier.pwyc_max ? parseFloat(ticket.tier.pwyc_max) : null;
		const currency = ticket.tier.currency?.toUpperCase() || 'EUR';
		const fmt = (v: number) => formatMoney(v, currency);

		if (min !== null && max !== null)
			return m['checkInDialog.suggestedRange']({ min: fmt(min), max: fmt(max) });
		if (min !== null) return m['checkInDialog.suggestedMin']({ min: fmt(min) });
		return null;
	});

	/**
	 * Displayed price. Priority: payment.amount > price_paid > tier price —
	 * online tickets never carry price_paid (the Payment row is authoritative,
	 * and can be net of VAT for reverse-charge buyers), while category-priced
	 * seats, discounts, comps and confirmed PWYC stamp price_paid. Only a plain
	 * flat-tier sale falls through to tier.price / the pwyc min–max range.
	 * Built as a single string so the dash/space formatting doesn't depend on
	 * template whitespace collapsing.
	 */
	const priceDisplay = $derived.by(() => {
		const recorded = ticket?.payment?.amount ?? ticket?.price_paid;
		if (recorded !== undefined && recorded !== null) {
			return formatPrice(recorded, ticket?.payment?.currency || ticket?.tier?.currency);
		}
		if (ticket?.tier?.price_type === 'pwyc' && ticket.tier?.pwyc_min) {
			const min = formatPrice(ticket.tier.pwyc_min, ticket.tier.currency);
			if (ticket.tier.pwyc_max) {
				return `${min} – ${formatPrice(ticket.tier.pwyc_max, ticket.tier.currency)}`;
			}
			return min;
		}
		return formatPrice(ticket?.tier?.price, ticket?.tier?.currency);
	});

	// Pre-fill with pwyc_min on open, reset on close
	$effect(() => {
		if (isOpen && needsPwycInput && ticket?.tier) {
			pwycPricePaid = ticket.price_paid || ticket.tier.pwyc_min || '';
		}
		if (!isOpen) {
			pwycPricePaid = '';
		}
	});

	/**
	 * Get payment method label
	 */
	function getPaymentMethodLabel(method: string): string {
		switch (method) {
			case 'online':
				return m['checkInDialog.paymentOnline']();
			case 'offline':
				return m['checkInDialog.paymentOffline']();
			case 'at_the_door':
				return m['checkInDialog.paymentAtTheDoor']();
			case 'free':
				return m['checkInDialog.paymentFree']();
			default:
				return method;
		}
	}

	type StatusTone = 'info' | 'success' | 'warning' | 'blocked';

	/**
	 * Status display info. The tone drives the callout's tint and icon; the label
	 * text always says the status, so meaning never rides on colour alone.
	 */
	function getStatusInfo(status: string): { label: string; tone: StatusTone } {
		switch (status) {
			case 'pending':
				return { label: m['checkInDialog.statusPendingPayment'](), tone: 'warning' };
			case 'active':
				return { label: m['checkInDialog.statusActive'](), tone: 'success' };
			case 'checked_in':
				return { label: m['checkInDialog.statusAlreadyCheckedIn'](), tone: 'info' };
			case 'cancelled':
				return { label: m['checkInDialog.statusCancelled'](), tone: 'blocked' };
			default:
				return { label: status, tone: 'info' };
		}
	}

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && !isLoading) {
			pwycPricePaid = '';
			onCancel();
		}
	}

	/**
	 * Handle escape key
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !isLoading) {
			pwycPricePaid = '';
			onCancel();
		}
	}

	/**
	 * Check if ticket can be checked in
	 * Allows check-in for active tickets, or pending tickets if payment confirmation is needed
	 * (organizer confirms offline payment was received)
	 */
	function canCheckIn(status: string, needsPayment: boolean): boolean {
		if (status === 'active') return true;
		if (status === 'pending' && needsPayment) return true;
		return false;
	}
</script>

{#if isOpen && ticket}
	{@const statusInfo = getStatusInfo(ticket.status)}
	{@const guestName = getGuestNameIfDifferent(ticket)}
	{@const seatInfo = getSeatDisplay(ticket)}
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
					{needsPaymentConfirmation || needsPwycInput
						? m['checkInDialog.confirmPaymentCheckInTitle']()
						: m['checkInDialog.checkInAttendeeTitle']()}
				</h2>
				<button
					type="button"
					onclick={onCancel}
					disabled={isLoading}
					class="rounded-full p-1 hover:bg-accent disabled:opacity-50"
					aria-label={m['checkInDialog.closeDialog']()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-4 px-6 py-4">
				<!-- Status Alert -->
				<ComplianceCallout tone={statusInfo.tone} role={null} testId="checkin-status">
					<p class="font-semibold">{statusInfo.label}</p>
					{#if ticket.status === 'checked_in'}
						<p>{m['checkInDialog.alreadyCheckedIn']()}</p>
					{:else if ticket.status === 'cancelled'}
						<p>{m['checkInDialog.ticketCancelled']()}</p>
					{:else if needsPaymentConfirmation}
						<p>{m['checkInDialog.confirmPaymentReceived']()}</p>
					{:else}
						<p>{m['checkInDialog.verifyIdentity']()}</p>
					{/if}
				</ComplianceCallout>

				<ScanCallout title={m['scanNote.label']()} body={ticket.private_note} />

				<!-- Attendee Information -->
				<div class="rounded-lg border bg-muted/50">
					<div class="border-b px-4 py-3">
						<h3 class="font-semibold">{m['checkInDialog.attendeeInfo']()}</h3>
					</div>
					<div class="divide-y">
						{#if guestName}
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">{m['checkInDialog.guestName']()}</span>
								<span class="font-medium text-primary">{guestName}</span>
							</div>
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-sm text-muted-foreground">{m['checkInDialog.purchasedBy']()}</span
								>
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
								<span class="text-sm text-muted-foreground">{m['checkInDialog.seat']()}</span>
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
								{priceDisplay}
							</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-sm text-muted-foreground">{m['checkInDialog.paymentMethod']()}</span
							>
							<span class="font-medium">
								{saleSourceLabel(ticket.sale_source) ??
									getPaymentMethodLabel(ticket.tier?.payment_method || '')}
							</span>
						</div>
					</div>
				</div>

				{#if needsPaymentConfirmation}
					<ComplianceCallout tone="warning" role={null}>
						<p>
							<strong>{m['checkInDialog.paymentRequired']()}</strong>
							{m['checkInDialog.ensurePaymentReceived']()}
						</p>
					</ComplianceCallout>
				{/if}

				{#if errorMessage}
					<ComplianceCallout tone="blocked" role="alert">
						<p>{errorMessage}</p>
					</ComplianceCallout>
				{/if}

				{#if needsPwycInput}
					<div class="space-y-2">
						<label for="checkin-pwyc-price-input" class="block text-sm font-medium text-foreground">
							{m['checkInDialog.amountPaid']({
								currency: ticket.tier?.currency?.toUpperCase() || 'EUR'
							})}
						</label>
						<Input
							id="checkin-pwyc-price-input"
							type="text"
							inputmode="decimal"
							value={pwycPricePaid}
							oninput={(e) => {
								pwycPricePaid = (e.currentTarget as HTMLInputElement).value
									.replace(/,/g, '.')
									.replace(/[^\d.]/g, '');
							}}
							placeholder={ticket.tier?.pwyc_min || '0.00'}
							aria-describedby={pwycWarning
								? 'checkin-pwyc-warning'
								: pwycRangeHint
									? 'checkin-pwyc-hint'
									: undefined}
						/>
						{#if pwycWarning}
							<p id="checkin-pwyc-warning" class="flex items-start gap-1.5 text-sm text-foreground">
								<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
								{pwycWarning}
							</p>
						{/if}
						{#if pwycRangeHint}
							<p id="checkin-pwyc-hint" class="text-sm text-muted-foreground">
								{pwycRangeHint}
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 border-t px-6 py-4">
				<Button
					variant="outline"
					onclick={() => {
						onCancel();
						pwycPricePaid = '';
					}}
					disabled={isLoading}>{m['checkInDialog.cancel']()}</Button
				>
				<Button
					variant="default"
					onclick={() => onConfirm(needsPwycInput ? pwycPricePaid : undefined)}
					disabled={!canSubmit || !canCheckIn(ticket.status, needsPaymentConfirmation)}
				>
					{#if isLoading}
						{m['checkInDialog.checkingIn']()}
					{:else if needsPaymentConfirmation || needsPwycInput}
						{m['checkInDialog.confirmPaymentCheckInTitle']()}
					{:else}
						{m['checkInDialog.checkIn']()}
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
