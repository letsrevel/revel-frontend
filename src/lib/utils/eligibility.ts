import type {
	EventUserEligibility,
	EventUserStatusResponse,
	NextStep,
	ReasonCode,
	EventRsvpSchema,
	UserTicketSchema,
	RsvpStatus as ApiRsvpStatus,
	TicketStatus as ApiTicketStatus
} from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';
import { formatDateTime } from './date';

/**
 * RSVP Status - Correctly typed from backend
 */
export type RsvpStatus = ApiRsvpStatus; // 'yes' | 'no' | 'maybe'

/**
 * Ticket Status - Correctly typed from backend
 */
export type TicketStatus = ApiTicketStatus; // 'pending' | 'active' | 'checked_in' | 'cancelled'

/**
 * Invitation Request Status - From EventInvitationRequest.Status backend enum
 * The generated types show this as just 'string', but backend actually uses a TextChoices enum
 */
export type InvitationRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Legacy alias for backward compatibility
 * @deprecated Use RsvpStatus instead
 */
export type RsvpAnswer = RsvpStatus;

/**
 * EventRsvpSchema with corrected status type
 */
export type EventRsvpSchemaActual = Omit<EventRsvpSchema, 'status'> & {
	status: RsvpStatus;
};

/**
 * UserTicketSchema with corrected status type
 * (Previously EventTicketSchema, now unified as UserTicketSchema)
 */
export type EventTicketSchemaActual = Omit<UserTicketSchema, 'status'> & {
	status: TicketStatus;
};

/**
 * User status returned from /my-status endpoint (new unified response)
 * This is the new format that includes multiple tickets and purchase limits
 */
export type UserEventStatusResponse = EventUserStatusResponse;

/**
 * Legacy user status type for backward compatibility
 * @deprecated The /my-status endpoint now returns EventUserStatusResponse or EventUserEligibility
 */
export type UserEventStatus =
	EventRsvpSchemaActual | EventTicketSchemaActual | EventUserEligibility | UserEventStatusResponse;

/**
 * Type guard to check if status is the new unified response format
 */
export function isUserStatusResponse(
	status: UserEventStatus | EventUserEligibility
): status is UserEventStatusResponse {
	return 'tickets' in status || 'can_purchase_more' in status;
}

/**
 * Type guard to check if status is an RSVP (legacy format)
 * @deprecated Use isUserStatusResponse and check rsvp field instead
 */
export function isRSVP(status: UserEventStatus): status is EventRsvpSchemaActual {
	if (isUserStatusResponse(status)) return false;
	return 'status' in status && !('tier' in status) && !('allowed' in status);
}

/**
 * Type guard to check if status is a Ticket (legacy format)
 * @deprecated Use isUserStatusResponse and check tickets array instead
 */
export function isTicket(status: UserEventStatus): status is EventTicketSchemaActual {
	if (isUserStatusResponse(status)) return false;
	return 'tier' in status && !('tickets' in status);
}

/**
 * Type guard to check if status is eligibility check result
 */
export function isEligibility(status: UserEventStatus): status is EventUserEligibility {
	return 'allowed' in status && !('tickets' in status);
}

/**
 * Check if user has any active tickets (non-cancelled)
 */
export function hasActiveTickets(status: UserEventStatusResponse): boolean {
	const tickets = status.tickets || [];
	return tickets.some((t) => t.status !== 'cancelled');
}

/**
 * Get the user's active tickets (non-cancelled)
 */
export function getActiveTickets(status: UserEventStatusResponse): EventTicketSchemaActual[] {
	const tickets = status.tickets || [];
	return tickets.filter((t) => t.status !== 'cancelled') as EventTicketSchemaActual[];
}

/**
 * Check if user has a positive RSVP
 */
export function hasPositiveRsvp(status: UserEventStatusResponse): boolean {
	return status.rsvp?.status === 'yes' || status.rsvp?.status === 'maybe';
}

/**
 * Check if user is attending (has active ticket or positive RSVP)
 */
export function isAttending(status: UserEventStatusResponse): boolean {
	return hasActiveTickets(status) || hasPositiveRsvp(status);
}

/**
 * Whether this user status counts as "attending" for the purpose of potluck
 * item claiming — across every shape `/my-status` can return, including the
 * legacy single-RSVP and single-ticket formats `isAttending` above doesn't
 * cover. Used by the event page (`hasRSVPd`) to gate `PotluckSection`.
 */
export function hasAttendingSignal(status: UserEventStatus | null | undefined): boolean {
	if (!status) return false;

	// New unified format: EventUserStatusResponse with tickets array and/or RSVP
	if (isUserStatusResponse(status)) {
		// User has active tickets = can claim potluck items
		if (hasActiveTickets(status)) return true;
		// User has positive RSVP = can claim potluck items
		if (hasPositiveRsvp(status)) return true;
		return false;
	}

	// Legacy format: Single RSVP — same positive statuses as hasPositiveRsvp,
	// or potluck access would depend on which /my-status shape came back.
	if (isRSVP(status)) {
		return status.status === 'yes' || status.status === 'maybe';
	}

	// Legacy format: Single Ticket
	if (isTicket(status)) {
		return status.status === 'active' || status.status === 'checked_in';
	}

	return false;
}

/**
 * Localized prose per event reason code.
 *
 * Deliberately near-empty, mirroring `membership-eligibility.ts`: every other
 * code still resolves through the backend-supplied `reason` string, which is
 * adequate prose (in the backend's locale) for codes the UI has no special
 * handling for. Entries are added only when the FE has something better to say.
 *
 * `membership_tier_required` (BE #807) is here because it has exactly one
 * emission site — `batch_ticket_service/eligibility.py:90`, the purchase path —
 * and the payload carries NOTHING to qualify it: no required-tier list, and no
 * way to tell a non-member from a member on the wrong tier (the backend emits
 * the same body for both, deliberately). So the copy has to be one sentence
 * that is true of both, and the FE-localized version beats the backend's.
 */
const REASON_CODE_MESSAGES: Partial<Record<ReasonCode, () => string>> = {
	membership_tier_required: () => m['eligibility.reason.membership_tier_required']()
};

/**
 * Localized prose for a reason code, or `null` when the code has no FE copy and
 * the caller should fall back to the backend `reason`.
 */
export function getReasonCodeMessage(reasonCode: ReasonCode | null | undefined): string | null {
	if (!reasonCode) return null;
	const mapped = REASON_CODE_MESSAGES[reasonCode];
	return mapped ? mapped() : null;
}

/**
 * Get user-friendly message for next step
 *
 * Most entries are still untranslated literals (pre-existing debt). The
 * `upgrade_membership` entry is localized because BE #807 made it reachable for
 * the first time — it is emitted by, and only by, the membership-tier gate.
 */
export function getNextStepMessage(nextStep: NextStep): string {
	const messages: Record<NextStep, string> = {
		rsvp: "You're eligible to RSVP for this event",
		purchase_ticket: 'Get your ticket to attend this event',
		complete_questionnaire: 'Complete the required questionnaire to attend',
		wait_for_questionnaire_evaluation: 'Your questionnaire submission is under review',
		wait_to_retake_questionnaire: 'You can retake the questionnaire soon',
		request_invitation: 'Request an invitation to attend this private event',
		wait_for_invitation_approval: 'Your invitation request is pending approval',
		become_member: 'Join the organization to attend this members-only event',
		join_waitlist: 'This event is full, but you can join the waitlist',
		wait_for_open_spot: "You're on the waitlist for this event",
		wait_for_event_to_open: 'Check back when registration opens',
		upgrade_membership: m['eligibility.nextStep.upgrade_membership'](),
		request_whitelist: 'Additional verification is required to access this organization',
		wait_for_whitelist_approval: 'Your verification request is pending approval',
		complete_profile: 'Complete your profile to attend this event'
	};

	return messages[nextStep] || 'Check your eligibility status';
}

/**
 * Get action button text for next step
 *
 * `upgrade_membership` reuses the org page's own CTA label rather than saying
 * "Upgrade Membership": the gate refuses non-members too (they have nothing to
 * upgrade), and the destination — the org's membership plans — is the same
 * place `membershipPlans.viewMembership` points at everywhere else, so the two
 * entry points must read identically.
 */
export function getActionButtonText(nextStep: NextStep): string {
	const buttonTexts: Record<NextStep, string> = {
		rsvp: 'RSVP',
		purchase_ticket: 'Buy Tickets',
		complete_questionnaire: 'Complete Questionnaire',
		wait_for_questionnaire_evaluation: 'Pending Review',
		wait_to_retake_questionnaire: 'Retry Available Soon',
		request_invitation: 'Request Invitation',
		wait_for_invitation_approval: 'Pending Approval',
		become_member: 'Join Organization',
		join_waitlist: 'Join Waitlist',
		wait_for_open_spot: "You're on the Waitlist",
		wait_for_event_to_open: 'Notify Me',
		upgrade_membership: m['membershipPlans.viewMembership'](),
		request_whitelist: 'Request Verification',
		wait_for_whitelist_approval: 'Verification Pending',
		complete_profile: 'Complete Profile'
	};

	return buttonTexts[nextStep] || 'View Details';
}

/**
 * Check if action button should be disabled
 */
export function isActionDisabled(nextStep: NextStep): boolean {
	const disabledStates: NextStep[] = [
		'wait_for_questionnaire_evaluation',
		'wait_to_retake_questionnaire',
		'wait_for_invitation_approval',
		'wait_for_event_to_open',
		'wait_for_open_spot',
		'wait_for_whitelist_approval'
	];

	return disabledStates.includes(nextStep);
}

/**
 * Get icon name for next step (using lucide-svelte icon names)
 */
export function getNextStepIcon(nextStep: NextStep): string {
	const icons: Record<NextStep, string> = {
		rsvp: 'Check',
		purchase_ticket: 'Ticket',
		complete_questionnaire: 'ClipboardList',
		wait_for_questionnaire_evaluation: 'Clock',
		wait_to_retake_questionnaire: 'Clock',
		request_invitation: 'Mail',
		wait_for_invitation_approval: 'Clock',
		become_member: 'UserPlus',
		join_waitlist: 'ListPlus',
		wait_for_open_spot: 'Clock',
		wait_for_event_to_open: 'Bell',
		upgrade_membership: 'ArrowUpCircle',
		request_whitelist: 'ShieldCheck',
		wait_for_whitelist_approval: 'Clock',
		complete_profile: 'UserCircle'
	};

	return icons[nextStep] || 'Info';
}

/**
 * Format retry date for display
 */
export function formatRetryDate(retryOn: string | null | undefined): string | null {
	if (!retryOn) return null;
	const date = new Date(retryOn);
	if (isNaN(date.getTime())) return null;
	return formatDateTime(retryOn);
}

/**
 * Get detailed eligibility explanation
 */
export function getEligibilityExplanation(eligibility: EventUserEligibility): string {
	if (eligibility.allowed) {
		return eligibility.next_step
			? getNextStepMessage(eligibility.next_step)
			: "You're eligible to attend this event";
	}

	// For complete_profile, always show our message since the backend reason
	// may be misleading (e.g., "Event is full" when the real issue is profile)
	if (eligibility.next_step === 'complete_profile') {
		return getNextStepMessage(eligibility.next_step);
	}

	// A mapped reason code outranks the backend prose: it says the same thing in
	// the *user's* locale (the backend renders `reason` in its own).
	const mapped = getReasonCodeMessage(eligibility.reason_code);
	if (mapped) return mapped;

	// Not allowed - show reason
	if (eligibility.reason) {
		return eligibility.reason;
	}

	// Fallback based on next_step
	if (eligibility.next_step) {
		return getNextStepMessage(eligibility.next_step);
	}

	return 'You are not currently eligible to attend this event';
}

/**
 * Runtime guard for a raw `EventUserEligibility` refusal body.
 *
 * Unlike `isEligibility`, which narrows an already-typed union, this probes an
 * `unknown` value: the purchase endpoints answer a refused checkout with 400 +
 * the eligibility payload (`exception_handlers.py:76`), and hey-api types that
 * error channel loosely. Requires `allowed === false` so a success body can
 * never be mistaken for a refusal.
 */
export function isEligibilityRefusal(value: unknown): value is EventUserEligibility {
	if (!value || typeof value !== 'object') return false;
	const body = value as { allowed?: unknown; event_id?: unknown };
	return body.allowed === false && typeof body.event_id === 'string';
}

/**
 * Localized message for an eligibility payload returned as a purchase error,
 * or `null` when the value is not one.
 *
 * Resolution mirrors `getEligibilityExplanation`: mapped reason code → backend
 * prose → next-step hint. Callers fall back to their own generic copy on null.
 */
export function getEligibilityRefusalMessage(value: unknown): string | null {
	if (!isEligibilityRefusal(value)) return null;
	return (
		getReasonCodeMessage(value.reason_code) ??
		value.reason ??
		(value.next_step ? getNextStepMessage(value.next_step) : null)
	);
}

/**
 * Is this thrown purchase error the membership-tier refusal (BE #807)?
 *
 * Checks the value itself and its `Error.cause`, because the checkout
 * controller re-throws the refusal body as the cause of a message-carrying
 * `Error` — the message is what the dialog prints, the cause is what lets it
 * decide whether to offer the membership-plans link alongside it.
 */
export function isMembershipTierRefusal(error: unknown): boolean {
	const cause = error && typeof error === 'object' ? (error as { cause?: unknown }).cause : null;
	return [error, cause].some(
		(candidate) =>
			isEligibilityRefusal(candidate) && candidate.reason_code === 'membership_tier_required'
	);
}

/**
 * Get RSVP status display text
 */
export function getRSVPStatusText(status: RsvpStatus): string {
	// Backend returns the user's actual answer: 'yes' | 'no' | 'maybe'
	if (status === 'yes') return "You're attending";
	if (status === 'maybe') return 'You might attend';
	if (status === 'no') return "You're not attending";
	return 'RSVP status unknown';
}

/**
 * Get ticket status display text
 */
export function getTicketStatusText(status?: TicketStatus): string {
	if (!status) return 'You have a ticket';

	if (status === 'active') return 'You have a ticket';
	if (status === 'cancelled') return 'Ticket canceled'; // Note: backend uses 'cancelled' not 'canceled'
	if (status === 'checked_in') return 'Checked in';
	if (status === 'pending') return 'Ticket pending';

	return 'You have a ticket';
}

/**
 * Get display text for multiple tickets
 */
export function getMultipleTicketsStatusText(tickets: EventTicketSchemaActual[]): string {
	const activeTickets = tickets.filter((t) => t.status !== 'cancelled');
	const count = activeTickets.length;

	if (count === 0) return 'No tickets';
	if (count === 1) return getTicketStatusText(activeTickets[0].status);

	const checkedIn = activeTickets.filter((t) => t.status === 'checked_in').length;
	const pending = activeTickets.filter((t) => t.status === 'pending').length;

	if (checkedIn === count) return `${count} tickets checked in`;
	if (pending === count) return `${count} tickets pending`;
	if (pending > 0) return `${count} tickets (${pending} pending)`;

	return `${count} tickets`;
}

/**
 * Check if any tickets have pending online payment
 */
export function hasPendingOnlinePayment(tickets: EventTicketSchemaActual[]): boolean {
	return tickets.some((t) => t.status === 'pending' && t.tier?.payment_method === 'online');
}

/**
 * Returns true when the user is allowed AND holds an active (pending) waitlist
 * offer. The backend signals this purely via `active_offer_expires_at`; there is
 * no dedicated next_step.
 */
export function hasActiveWaitlistOffer(eligibility: EventUserEligibility): boolean {
	return eligibility.allowed === true && !!eligibility.active_offer_expires_at;
}

/**
 * Get user-friendly label for a missing profile field
 */
export function getMissingProfileFieldLabel(field: string): string {
	const labels: Record<string, string> = {
		profile_picture: 'Profile picture',
		pronouns: 'Pronouns',
		name: 'Display name'
	};

	return labels[field] || field;
}

/**
 * Get all missing profile field labels
 */
export function getMissingProfileFieldLabels(fields: string[]): string[] {
	return fields.map(getMissingProfileFieldLabel);
}
