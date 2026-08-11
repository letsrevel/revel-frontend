import * as m from '$lib/paraglide/messages.js';
import { createMutation } from '@tanstack/svelte-query';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { eventadminticketsCheckInTicket, eventadminticketsGetTicket } from '$lib/api';
import type { MemberScanResponseSchema } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
import { getUserDisplayName } from '$lib/utils/user-display';
import { needsPaymentConfirmation } from '$lib/utils/ticket-helpers';
import { isSeriesPassCode } from '$lib/utils/series-pass-qr';
import { isMemberCode, normalizeMemberCode } from '$lib/utils/member-qr';
import { classifyCheckInResponse } from '$lib/utils/check-in-scan';
import { toCheckInTicket, type CheckInDialogTicket } from './checkin-adapter';

interface Options {
	/** Event id for the event-admin ticket endpoints. */
	getEventId: () => string;
	/** Bearer access token, or nullish when unauthenticated. */
	getAccessToken: () => string | null | undefined;
}

/**
 * The whole scan → check-in flow for the event tickets admin page: the QR
 * scanner modal, the confirm dialog, and the membership-card report.
 *
 * Extracted from the route (same factory idiom as `createTicketMemberAdmin` and
 * `createTicketCancelRefundAdmin`) because that file sits within a dozen lines of
 * the 750-line Svelte cap and the `member:` namespace could not fit inside it.
 *
 * Instantiate once at component init — it uses runes — and bind the dialogs in
 * the page template to the returned accessors.
 */
export function createTicketScanCheckIn(opts: Options) {
	let showQRScanner = $state(false);
	let showCheckInDialog = $state(false);
	let ticketToCheckIn = $state<CheckInDialogTicket | null>(null);
	let checkInDialogError = $state<string | null>(null);

	/** The membership-card report: no ticket was burned, this is information. */
	let memberReport = $state<MemberScanResponseSchema | null>(null);
	/** Set while a specific ticket row inside the member report is being resolved. */
	let pendingMemberTicketId = $state<string | null>(null);

	const checkInTicketMutation = createMutation(() => ({
		// `code` is a ticket UUID, a series-pass payload (`series:<uuid>`), or a
		// membership card (`member:<uuid>`). The backend resolves pass codes to the
		// holder's ticket for this event; membership cards are report-only unless
		// the member holds exactly one non-cancelled ticket.
		mutationFn: async ({ code, pricePaid }: { code: string; pricePaid?: string }) => {
			const response = await eventadminticketsCheckInTicket({
				path: { event_id: opts.getEventId(), code },
				body: pricePaid ? { price_paid: pricePaid } : undefined,
				headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
			});

			if (response.error) {
				const errorDetail =
					extractApiErrorDetail(response.error) ?? m['eventTicketsAdmin.checkInError']();
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
			checkInDialogError = null;
			invalidateAll();
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : m['eventTicketsAdmin.checkInError']();
			// The dialog stays open on failure, so it shows the reason inline;
			// the toast still covers scan-initiated check-ins with no dialog.
			checkInDialogError = message;
			toast.error(message);
		}
	}));

	/**
	 * Route a 200 to the surface that should show it. A `member` outcome means
	 * NOTHING was checked in — the report replaces the success toast rather than
	 * accompanying it, or staff would walk away believing someone was admitted.
	 */
	function routeScanOutcome(payload: unknown, successMessage: (name: string) => string): void {
		const outcome = classifyCheckInResponse(payload);
		if (outcome.kind === 'member') {
			memberReport = outcome.report;
			return;
		}
		if (outcome.kind === 'checked_in') {
			toast.success(successMessage(getUserDisplayName(outcome.result.user)));
			return;
		}
		// A 200 we cannot classify: say something true rather than nothing.
		toast.success(m['eventTicketsAdmin.checkInSuccessGeneric']());
	}

	/**
	 * Handle a scanned or hand-typed code.
	 *
	 * Ticket QRs carry a bare UUID we can preview via GET before confirming.
	 * Series-pass and membership QRs have no preview endpoint, so they go straight
	 * to the check-in endpoint, which decides what (if anything) to burn.
	 */
	async function handleQRScan(code: string): Promise<void> {
		if (isMemberCode(code)) {
			showQRScanner = false;
			checkInTicketMutation.mutate(
				{ code: normalizeMemberCode(code) },
				{
					onSuccess: (data) => {
						routeScanOutcome(data, (name) => m['memberScan.checkedInSuccess']({ name }));
					}
				}
			);
			return;
		}

		if (isSeriesPassCode(code)) {
			showQRScanner = false;
			checkInTicketMutation.mutate(
				{ code },
				{
					onSuccess: (data) => {
						routeScanOutcome(data, (name) => m['eventTicketsAdmin.passCheckInSuccess']({ name }));
					}
				}
			);
			return;
		}

		try {
			const response = await eventadminticketsGetTicket({
				path: { event_id: opts.getEventId(), ticket_id: code },
				headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
			});

			if (response.error || !response.data) {
				throw new Error('Ticket not found');
			}

			ticketToCheckIn = toCheckInTicket(response.data);
			checkInDialogError = null;
			showCheckInDialog = true;
			showQRScanner = false;
		} catch (err) {
			console.error('Failed to fetch ticket:', err);
			// Error will be shown in the scanner component
		}
	}

	/** Open the confirm dialog for a ticket picked from the table. */
	function openCheckIn(ticket: Parameters<typeof toCheckInTicket>[0]): void {
		ticketToCheckIn = toCheckInTicket(ticket);
		checkInDialogError = null;
		showCheckInDialog = true;
	}

	function submitCheckIn(pricePaid?: string): void {
		if (ticketToCheckIn) {
			checkInTicketMutation.mutate({ code: ticketToCheckIn.id, pricePaid });
		}
	}

	function closeCheckIn(): void {
		showCheckInDialog = false;
		ticketToCheckIn = null;
		checkInDialogError = null;
	}

	/**
	 * Check in one specific ticket chosen from the multiple-tickets member report.
	 *
	 * The backend refuses to GUESS which of several tickets to burn; a human
	 * picking one is not a guess. It still cannot be a blind POST: a PENDING
	 * Pay-What-You-Can ticket needs a price, and `MemberScanTicketSummarySchema`
	 * carries no tier or payment-method fields to tell us so. We therefore fetch
	 * the full ticket first and hand the PWYC case to the dialog that already does
	 * price entry.
	 *
	 * Deciding BEFORE the request, rather than escalating on the 400, is
	 * deliberate: that error message is localized server-side, so matching on its
	 * text would work in English and silently fail in the other five locales.
	 */
	async function checkInMemberTicket(ticketId: string): Promise<void> {
		if (pendingMemberTicketId) return;
		pendingMemberTicketId = ticketId;
		try {
			const response = await eventadminticketsGetTicket({
				path: { event_id: opts.getEventId(), ticket_id: ticketId },
				headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
			});

			if (response.error || !response.data) {
				toast.error(m['eventTicketsAdmin.checkInError']());
				return;
			}

			if (needsPaymentConfirmation(response.data)) {
				memberReport = null;
				openCheckIn(response.data);
				return;
			}

			checkInTicketMutation.mutate(
				{ code: ticketId },
				{
					onSuccess: (data) => {
						memberReport = null;
						routeScanOutcome(data, (name) => m['memberScan.checkedInSuccess']({ name }));
					}
				}
			);
		} finally {
			pendingMemberTicketId = null;
		}
	}

	function closeMemberReport(): void {
		memberReport = null;
	}

	return {
		get showQRScanner() {
			return showQRScanner;
		},
		set showQRScanner(value: boolean) {
			showQRScanner = value;
		},
		get showCheckInDialog() {
			return showCheckInDialog;
		},
		get ticketToCheckIn() {
			return ticketToCheckIn;
		},
		get checkInDialogError() {
			return checkInDialogError;
		},
		get checkInPending() {
			return checkInTicketMutation.isPending;
		},
		get memberReport() {
			return memberReport;
		},
		get pendingMemberTicketId() {
			return pendingMemberTicketId;
		},
		handleQRScan,
		openCheckIn,
		submitCheckIn,
		closeCheckIn,
		checkInMemberTicket,
		closeMemberReport
	};
}
