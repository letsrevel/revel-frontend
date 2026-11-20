import * as m from '$lib/paraglide/messages.js';
import { isInvitationRequiredBody } from '$lib/member-register/error-codes';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

/**
 * Message for a failed staff "RSVP on behalf" call. The backend refuses with a
 * stable `invitation_required` code when the account has no connection to the
 * organization yet (ADR-0020); branch on that code, never on the translated
 * `detail`, and fall back to the server detail / a generic message otherwise.
 */
export function rsvpCreateErrorMessage(error: unknown): string {
	if (isInvitationRequiredBody(error)) return m['attendeesAdmin.invitationRequired']();
	return extractApiErrorDetail(error) ?? m['attendeesAdmin.createError']();
}
