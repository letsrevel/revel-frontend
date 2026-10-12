import type { NotificationType, NotificationTypeSettings } from '$lib/api/generated/types.gen.js';

/**
 * Mirrors `MANDATORY_TYPES` in revel-backend `notifications/enums.py`: receipts for
 * the recipient's OWN transaction. They ignore silence-all, the channel
 * checkboxes and per-type settings, and always deliver in-app + email.
 */
const MANDATORY_TYPES: ReadonlySet<string> = new Set<NotificationType>([
	'payment_confirmation',
	'ticket_created',
	'ticket_cancelled',
	'ticket_refunded',
	'subscription_renewal_succeeded',
	'subscription_payment_failed',
	'subscription_expired',
	'subscription_cancellation_confirmed',
	'subscription_revival_checkout',
	'account_banned',
	'system_announcement'
]);

/**
 * Staff alerts for ticket sales, cancellations and refunds reuse the `ticket_*`
 * types. For org owners/staff they are NOT mandatory: silence-all, channels and
 * per-type settings all apply to them.
 */
const STAFF_SHARED_TYPES: ReadonlySet<string> = new Set<NotificationType>([
	'ticket_created',
	'ticket_cancelled',
	'ticket_refunded'
]);

/** Transactional alerts an owner/staff member would miss by switching them off. */
const STAFF_TRANSACTIONAL_TYPES: readonly NotificationType[] = [
	'ticket_created',
	'ticket_cancelled',
	'ticket_refunded',
	'rsvp_confirmation',
	'rsvp_updated',
	'rsvp_cancelled',
	'questionnaire_submitted',
	'invitation_request_created',
	'membership_request_created',
	'whitelist_request_created',
	'series_pass_purchased',
	'series_pass_cancelled'
];

export function isMandatoryType(type: string): boolean {
	return MANDATORY_TYPES.has(type);
}

/** Mandatory for the user's own purchase, yet also a preference-driven alert for org staff. */
export function isStaffSharedMandatoryType(type: string): boolean {
	return STAFF_SHARED_TYPES.has(type);
}

/** Whether the per-type settings switch off at least one staff transactional alert. */
export function disablesStaffAlerts(settings: Record<string, NotificationTypeSettings>): boolean {
	return STAFF_TRANSACTIONAL_TYPES.some((type) => {
		const s = settings[type];
		return !!s && (s.enabled === false || (s.channels !== undefined && s.channels.length === 0));
	});
}
