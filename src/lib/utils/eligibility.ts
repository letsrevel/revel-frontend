import type {
	EventUserEligibility,
	NextStep,
	EventRsvpSchema,
	EventTicketSchema
} from '$lib/api/generated/types.gen';

/**
 * RSVP answer type (what backend actually returns)
 * Note: The generated type says 'approved' | 'rejected' | 'pending review' but that's incorrect.
 * The backend actually returns the user's answer: 'yes' | 'no' | 'maybe'
 */
export type RsvpAnswer = 'yes' | 'no' | 'maybe';

/**
 * EventRsvpSchema with corrected status type
 */
export type EventRsvpSchemaActual = Omit<EventRsvpSchema, 'status'> & {
	status: RsvpAnswer;
};

/**
 * User status returned from /my-status endpoint
 */
export type UserEventStatus = EventRsvpSchemaActual | EventTicketSchema | EventUserEligibility;

/**
 * Type guard to check if status is an RSVP
 */
export function isRSVP(status: UserEventStatus): status is EventRsvpSchemaActual {
	return 'status' in status && !('tier' in status) && !('allowed' in status);
}

/**
 * Type guard to check if status is a Ticket
 */
export function isTicket(status: UserEventStatus): status is EventTicketSchema {
	return 'tier' in status;
}

/**
 * Type guard to check if status is eligibility check result
 */
export function isEligibility(status: UserEventStatus): status is EventUserEligibility {
	return 'allowed' in status;
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
		wait_for_event_to_open: 'Check back when registration opens'
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
		wait_for_event_to_open: 'Notify Me'
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
		'wait_for_event_to_open'
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
		wait_for_event_to_open: 'Bell'
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
export function getRSVPStatusText(status: RsvpAnswer): string {
	// Backend returns the user's actual answer: 'yes' | 'no' | 'maybe'
	if (status === 'yes') return "You're attending";
	if (status === 'maybe') return 'You might attend';
	if (status === 'no') return "You're not attending";
	return 'RSVP status unknown';
}

/**
 * Get ticket status display text
 */
export function getTicketStatusText(status?: string): string {
	if (!status) return 'You have a ticket';

	if (status === 'active') return 'You have a ticket';
	if (status === 'canceled') return 'Ticket canceled';
	if (status === 'checked_in') return 'Checked in';
	if (status === 'refunded') return 'Ticket refunded';

	return 'You have a ticket';
}
