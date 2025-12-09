import type {
	EventUserEligibility,
	EventUserStatusResponse,
	NextStep,
	EventRsvpSchema,
	EventTicketSchema,
	RsvpStatus as ApiRsvpStatus,
	TicketStatus as ApiTicketStatus
} from '$lib/api/generated/types.gen';

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
 * Membership Request Status - From OrganizationMembershipRequest.Status backend enum
 * The generated types show this as just 'string', but backend actually uses a TextChoices enum
 */
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected';

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
 * EventTicketSchema with corrected status type
 */
export type EventTicketSchemaActual = Omit<EventTicketSchema, 'status'> & {
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
	| EventRsvpSchemaActual
	| EventTicketSchemaActual
	| EventUserEligibility
	| UserEventStatusResponse;

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
 * Get user-friendly message for next step
 */
export function getNextStepMessage(nextStep: NextStep): string {
	const messages: Record<NextStep, string> = {
		rsvp: "You're eligible to RSVP for this event",
		purchase_ticket: 'Get your ticket to attend this event',
		complete_questionnaire: 'Complete the required questionnaire to attend',
		wait_for_questionnaire_evaluation: 'Your questionnaire submission is under review',
		wait_to_retake_questionnaire: 'You can retake the questionnaire soon',
		request_invitation: 'Request an invitation to attend this private event',
		become_member: 'Join the organization to attend this members-only event',
		join_waitlist: 'This event is full, but you can join the waitlist',
		wait_for_open_spot: "You're on the waitlist for this event",
		wait_for_event_to_open: 'Check back when registration opens',
		upgrade_membership: 'Upgrade your membership tier to attend this event'
	};

	return messages[nextStep] || 'Check your eligibility status';
}

/**
 * Get action button text for next step
 */
export function getActionButtonText(nextStep: NextStep): string {
	const buttonTexts: Record<NextStep, string> = {
		rsvp: 'RSVP',
		purchase_ticket: 'Buy Tickets',
		complete_questionnaire: 'Complete Questionnaire',
		wait_for_questionnaire_evaluation: 'Pending Review',
		wait_to_retake_questionnaire: 'Retry Available Soon',
		request_invitation: 'Request Invitation',
		become_member: 'Join Organization',
		join_waitlist: 'Join Waitlist',
		wait_for_open_spot: "You're on the Waitlist",
		wait_for_event_to_open: 'Notify Me',
		upgrade_membership: 'Upgrade Membership'
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
		'wait_for_event_to_open',
		'wait_for_open_spot'
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
		become_member: 'UserPlus',
		join_waitlist: 'ListPlus',
		wait_for_open_spot: 'Clock',
		wait_for_event_to_open: 'Bell',
		upgrade_membership: 'ArrowUpCircle'
	};

	return icons[nextStep] || 'Info';
}

/**
 * Format retry date for display
 */
export function formatRetryDate(retryOn: string | null | undefined): string | null {
	if (!retryOn) return null;

	const date = new Date(retryOn);
	const now = new Date();
	const diff = date.getTime() - now.getTime();
	const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

	if (days === 0) return 'later today';
	if (days === 1) return 'tomorrow';
	if (days < 7) return `in ${days} days`;

	return date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
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
	return tickets.some(
		(t) => t.status === 'pending' && t.tier?.payment_method === 'online'
	);
}
