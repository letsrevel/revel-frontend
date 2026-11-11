import * as m from '$lib/paraglide/messages.js';
import type { NotificationType } from '$lib/api/generated/types.gen.js';

/** Paraglide's locale union, derived from the generated message signature. */
type Locale = NonNullable<
	Parameters<(typeof m)['notificationPreferences.typeOrgSetupNudge']>[1]
>['locale'];

interface NotificationTypeCopy {
	label: (locale?: Locale) => string;
	description?: (locale?: Locale) => string;
}

/**
 * Human labels for every notification type. The record is exhaustive over the
 * generated `NotificationType` union, so a new API value fails the type check
 * until it gets a translated label in all six catalogs.
 *
 * Staff alerts (`staff_*`) and their attendee twins must read differently in
 * every locale; labels must stay unique per locale (see the test suite).
 */
const NOTIFICATION_TYPE_COPY: Record<NotificationType, NotificationTypeCopy> = {
	ticket_created: {
		label: (locale) => m['notificationPreferences.typeTicketCreated']({}, { locale })
	},
	ticket_updated: {
		label: (locale) => m['notificationPreferences.typeTicketUpdated']({}, { locale })
	},
	ticket_cancelled: {
		label: (locale) => m['notificationPreferences.typeTicketCancelled']({}, { locale })
	},
	ticket_refunded: {
		label: (locale) => m['notificationPreferences.typeTicketRefunded']({}, { locale })
	},
	ticket_checked_in: {
		label: (locale) => m['notificationPreferences.typeTicketCheckedIn']({}, { locale })
	},
	payment_confirmation: {
		label: (locale) => m['notificationPreferences.typePaymentConfirmation']({}, { locale })
	},
	refund_unmatched: {
		label: (locale) => m['notificationPreferences.typeRefundUnmatched']({}, { locale })
	},
	staff_ticket_created: {
		label: (locale) => m['notificationPreferences.typeStaffTicketCreated']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffTicketCreatedDescription']({}, { locale })
	},
	staff_ticket_cancelled: {
		label: (locale) => m['notificationPreferences.typeStaffTicketCancelled']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffTicketCancelledDescription']({}, { locale })
	},
	staff_ticket_refunded: {
		label: (locale) => m['notificationPreferences.typeStaffTicketRefunded']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffTicketRefundedDescription']({}, { locale })
	},
	staff_payment_disputed: {
		label: (locale) => m['notificationPreferences.typeStaffPaymentDisputed']({}, { locale })
	},
	event_open: {
		label: (locale) => m['notificationPreferences.typeEventOpen']({}, { locale })
	},
	event_updated: {
		label: (locale) => m['notificationPreferences.typeEventUpdated']({}, { locale })
	},
	event_cancelled: {
		label: (locale) => m['notificationPreferences.typeEventCancelled']({}, { locale })
	},
	event_reminder: {
		label: (locale) => m['notificationPreferences.typeEventReminder']({}, { locale })
	},
	event_refund_summary: {
		label: (locale) => m['notificationPreferences.typeEventRefundSummary']({}, { locale })
	},
	rsvp_confirmation: {
		label: (locale) => m['notificationPreferences.typeRsvpConfirmation']({}, { locale })
	},
	rsvp_updated: {
		label: (locale) => m['notificationPreferences.typeRsvpUpdated']({}, { locale })
	},
	rsvp_cancelled: {
		label: (locale) => m['notificationPreferences.typeRsvpCancelled']({}, { locale })
	},
	potluck_item_created: {
		label: (locale) => m['notificationPreferences.typePotluckItemCreated']({}, { locale })
	},
	potluck_item_created_and_claimed: {
		label: (locale) => m['notificationPreferences.typePotluckItemCreatedAndClaimed']({}, { locale })
	},
	potluck_item_updated: {
		label: (locale) => m['notificationPreferences.typePotluckItemUpdated']({}, { locale })
	},
	potluck_item_claimed: {
		label: (locale) => m['notificationPreferences.typePotluckItemClaimed']({}, { locale })
	},
	potluck_item_unclaimed: {
		label: (locale) => m['notificationPreferences.typePotluckItemUnclaimed']({}, { locale })
	},
	potluck_item_deleted: {
		label: (locale) => m['notificationPreferences.typePotluckItemDeleted']({}, { locale })
	},
	questionnaire_submitted: {
		label: (locale) => m['notificationPreferences.typeQuestionnaireSubmitted']({}, { locale })
	},
	questionnaire_evaluation_result: {
		label: (locale) =>
			m['notificationPreferences.typeQuestionnaireEvaluationResult']({}, { locale })
	},
	invitation_received: {
		label: (locale) => m['notificationPreferences.typeInvitationReceived']({}, { locale })
	},
	invitation_request_created: {
		label: (locale) => m['notificationPreferences.typeInvitationRequestCreated']({}, { locale })
	},
	membership_granted: {
		label: (locale) => m['notificationPreferences.typeMembershipGranted']({}, { locale })
	},
	membership_promoted: {
		label: (locale) => m['notificationPreferences.typeMembershipPromoted']({}, { locale })
	},
	membership_removed: {
		label: (locale) => m['notificationPreferences.typeMembershipRemoved']({}, { locale })
	},
	membership_card_updated: {
		label: (locale) => m['notificationPreferences.typeMembershipCardUpdated']({}, { locale })
	},
	membership_request_created: {
		label: (locale) => m['notificationPreferences.typeMembershipRequestCreated']({}, { locale })
	},
	membership_request_approved: {
		label: (locale) => m['notificationPreferences.typeMembershipRequestApproved']({}, { locale })
	},
	membership_request_rejected: {
		label: (locale) => m['notificationPreferences.typeMembershipRequestRejected']({}, { locale })
	},
	staff_member_record_auto_linked: {
		label: (locale) => m['notificationPreferences.typeStaffMemberRecordAutoLinked']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffMemberRecordAutoLinkedDescription']({}, { locale })
	},
	org_announcement: {
		label: (locale) => m['notificationPreferences.typeOrgAnnouncement']({}, { locale })
	},
	org_contact_message_received: {
		label: (locale) => m['notificationPreferences.typeOrgContactMessageReceived']({}, { locale })
	},
	org_setup_nudge: {
		label: (locale) => m['notificationPreferences.typeOrgSetupNudge']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeOrgSetupNudgeDescription']({}, { locale })
	},
	org_custom_domain_active: {
		label: (locale) => m['notificationPreferences.typeOrgCustomDomainActive']({}, { locale })
	},
	org_custom_domain_failed: {
		label: (locale) => m['notificationPreferences.typeOrgCustomDomainFailed']({}, { locale })
	},
	fiscal_document_skipped: {
		label: (locale) => m['notificationPreferences.typeFiscalDocumentSkipped']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeFiscalDocumentSkippedDescription']({}, { locale })
	},
	waitlist_spot_available: {
		label: (locale) => m['notificationPreferences.typeWaitlistSpotAvailable']({}, { locale })
	},
	whitelist_request_created: {
		label: (locale) => m['notificationPreferences.typeWhitelistRequestCreated']({}, { locale })
	},
	whitelist_request_approved: {
		label: (locale) => m['notificationPreferences.typeWhitelistRequestApproved']({}, { locale })
	},
	whitelist_request_rejected: {
		label: (locale) => m['notificationPreferences.typeWhitelistRequestRejected']({}, { locale })
	},
	account_banned: {
		label: (locale) => m['notificationPreferences.typeAccountBanned']({}, { locale })
	},
	system_announcement: {
		label: (locale) => m['notificationPreferences.typeSystemAnnouncement']({}, { locale })
	},
	organization_followed: {
		label: (locale) => m['notificationPreferences.typeOrganizationFollowed']({}, { locale })
	},
	event_series_followed: {
		label: (locale) => m['notificationPreferences.typeEventSeriesFollowed']({}, { locale })
	},
	new_event_from_followed_org: {
		label: (locale) => m['notificationPreferences.typeNewEventFromFollowedOrg']({}, { locale })
	},
	new_event_from_followed_series: {
		label: (locale) => m['notificationPreferences.typeNewEventFromFollowedSeries']({}, { locale })
	},
	series_events_generated: {
		label: (locale) => m['notificationPreferences.typeSeriesEventsGenerated']({}, { locale })
	},
	series_pass_purchased: {
		label: (locale) => m['notificationPreferences.typeSeriesPassPurchased']({}, { locale })
	},
	series_pass_extended: {
		label: (locale) => m['notificationPreferences.typeSeriesPassExtended']({}, { locale })
	},
	series_pass_cancelled: {
		label: (locale) => m['notificationPreferences.typeSeriesPassCancelled']({}, { locale })
	},
	staff_series_pass_purchased: {
		label: (locale) => m['notificationPreferences.typeStaffSeriesPassPurchased']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffSeriesPassPurchasedDescription']({}, { locale })
	},
	staff_series_pass_cancelled: {
		label: (locale) => m['notificationPreferences.typeStaffSeriesPassCancelled']({}, { locale }),
		description: (locale) =>
			m['notificationPreferences.typeStaffSeriesPassCancelledDescription']({}, { locale })
	},
	subscription_renewal_succeeded: {
		label: (locale) => m['notificationPreferences.typeSubscriptionRenewalSucceeded']({}, { locale })
	},
	subscription_payment_failed: {
		label: (locale) => m['notificationPreferences.typeSubscriptionPaymentFailed']({}, { locale })
	},
	subscription_expired: {
		label: (locale) => m['notificationPreferences.typeSubscriptionExpired']({}, { locale })
	},
	subscription_cancellation_confirmed: {
		label: (locale) =>
			m['notificationPreferences.typeSubscriptionCancellationConfirmed']({}, { locale })
	},
	subscription_renewal_reminder: {
		label: (locale) => m['notificationPreferences.typeSubscriptionRenewalReminder']({}, { locale })
	},
	subscription_price_migration_notice: {
		label: (locale) =>
			m['notificationPreferences.typeSubscriptionPriceMigrationNotice']({}, { locale })
	},
	subscription_revival_checkout: {
		label: (locale) => m['notificationPreferences.typeSubscriptionRevivalCheckout']({}, { locale })
	}
};

/** Copy entry for a known notification type, or `undefined` for one this build doesn't know. */
function getCopy(type: string): NotificationTypeCopy | undefined {
	// hasOwn, not `in`: the API may send a type this build doesn't know yet, and
	// `in` would also match prototype keys like `toString`.
	return Object.hasOwn(NOTIFICATION_TYPE_COPY, type)
		? NOTIFICATION_TYPE_COPY[type as NotificationType]
		: undefined;
}

/** Whether `type` has a translated label (vs. the raw-name fallback). */
export function hasNotificationTypeLabel(type: string): boolean {
	return getCopy(type) !== undefined;
}

/**
 * Localized label for a notification type. Unknown types (a value the API sends
 * before this build knows it) fall back to the raw name with underscores as spaces.
 */
export function getNotificationTypeLabel(type: string, locale?: Locale): string {
	return getCopy(type)?.label(locale) ?? type.replace(/_/g, ' ');
}

/**
 * Localized one-line description of a notification type, shown under its label in
 * the notification settings. `undefined` when the type has none (or is unknown).
 */
export function getNotificationTypeDescription(type: string, locale?: Locale): string | undefined {
	return getCopy(type)?.description?.(locale);
}
