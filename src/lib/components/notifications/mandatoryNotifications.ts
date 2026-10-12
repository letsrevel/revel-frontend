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
 * Transactional alerts an owner/staff member would miss by switching them off.
 * The `staff_*` types are separate from the holder-only `ticket_*` /
 * `series_pass_*` types (BE #1127 / #1130) and are never mandatory.
 */
const STAFF_TRANSACTIONAL_TYPES: readonly NotificationType[] = [
	'staff_ticket_created',
	'staff_ticket_cancelled',
	'staff_ticket_refunded',
	'rsvp_confirmation',
	'rsvp_updated',
	'rsvp_cancelled',
	'questionnaire_submitted',
	'invitation_request_created',
	'membership_request_created',
	'whitelist_request_created',
	'staff_series_pass_purchased',
	'staff_series_pass_cancelled'
];

export function isMandatoryType(type: string): boolean {
	return MANDATORY_TYPES.has(type);
}

/** Whether the per-type settings switch off at least one staff transactional alert. */
export function disablesStaffAlerts(settings: Record<string, NotificationTypeSettings>): boolean {
	return STAFF_TRANSACTIONAL_TYPES.some((type) => {
		const s = settings[type];
		return !!s && (s.enabled === false || (s.channels !== undefined && s.channels.length === 0));
	});
}
