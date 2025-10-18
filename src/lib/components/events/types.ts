/**
 * Shared types for event components
 */

/**
 * User's relationship to an event
 */
export interface UserEventStatus {
	/**
	 * User has RSVP'd or has a ticket for this event
	 */
	attending: boolean;

	/**
	 * User is an organizer/admin for this event
	 */
	organizing: boolean;

	/**
	 * User has been invited but hasn't responded
	 */
	invitationPending: boolean;

	/**
	 * User is on the waitlist for this event
	 */
	waitlisted: boolean;
}
