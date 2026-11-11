import { describe, it, expect } from 'vitest';
import type { NotificationType } from '$lib/api/generated/types.gen.js';
import {
	getNotificationTypeDescription,
	getNotificationTypeLabel,
	hasNotificationTypeLabel
} from './notificationTypeLabels';

// Exhaustive over the generated union: adding a NotificationType without listing it
// here is a type error, so the runtime checks below always cover every value.
const EXHAUSTIVE: Record<NotificationType, true> = {
	ticket_created: true,
	ticket_updated: true,
	ticket_cancelled: true,
	ticket_refunded: true,
	ticket_checked_in: true,
	payment_confirmation: true,
	refund_unmatched: true,
	staff_ticket_created: true,
	staff_ticket_cancelled: true,
	staff_ticket_refunded: true,
	staff_payment_disputed: true,
	event_open: true,
	event_updated: true,
	event_cancelled: true,
	event_reminder: true,
	event_refund_summary: true,
	rsvp_confirmation: true,
	rsvp_updated: true,
	rsvp_cancelled: true,
	potluck_item_created: true,
	potluck_item_created_and_claimed: true,
	potluck_item_updated: true,
	potluck_item_claimed: true,
	potluck_item_unclaimed: true,
	potluck_item_deleted: true,
	questionnaire_submitted: true,
	questionnaire_evaluation_result: true,
	invitation_received: true,
	invitation_request_created: true,
	membership_granted: true,
	membership_promoted: true,
	membership_removed: true,
	membership_card_updated: true,
	membership_request_created: true,
	membership_request_approved: true,
	membership_request_rejected: true,
	staff_member_record_auto_linked: true,
	org_announcement: true,
	org_contact_message_received: true,
	org_setup_nudge: true,
	org_custom_domain_active: true,
	org_custom_domain_failed: true,
	fiscal_document_skipped: true,
	waitlist_spot_available: true,
	whitelist_request_created: true,
	whitelist_request_approved: true,
	whitelist_request_rejected: true,
	account_banned: true,
	system_announcement: true,
	organization_followed: true,
	event_series_followed: true,
	new_event_from_followed_org: true,
	new_event_from_followed_series: true,
	series_events_generated: true,
	series_pass_purchased: true,
	series_pass_extended: true,
	series_pass_cancelled: true,
	staff_series_pass_purchased: true,
	staff_series_pass_cancelled: true,
	subscription_renewal_succeeded: true,
	subscription_payment_failed: true,
	subscription_expired: true,
	subscription_cancellation_confirmed: true,
	subscription_renewal_reminder: true,
	subscription_price_migration_notice: true,
	subscription_revival_checkout: true
};

const ALL_TYPES = Object.keys(EXHAUSTIVE) as NotificationType[];

const LOCALES = ['en', 'de', 'fr', 'it', 'es', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

describe('notificationTypeLabels (#996)', () => {
	it('translates org_setup_nudge', () => {
		expect(hasNotificationTypeLabel('org_setup_nudge')).toBe(true);
		expect(getNotificationTypeLabel('org_setup_nudge', 'en')).toBe('Organization setup tips');
		expect(getNotificationTypeDescription('org_setup_nudge', 'en')).toMatch(
			/at most one every two weeks/i
		);
	});

	it('translates fiscal_document_skipped (#1008)', () => {
		expect(hasNotificationTypeLabel('fiscal_document_skipped')).toBe(true);
		expect(getNotificationTypeLabel('fiscal_document_skipped', 'en')).toBe(
			'Documents to issue yourself'
		);
		expect(getNotificationTypeDescription('fiscal_document_skipped', 'en')).toMatch(
			/daily summary/i
		);
	});

	it.each([
		['staff_ticket_created', 'Ticket sold'],
		['staff_ticket_cancelled', 'Ticket cancelled'],
		['staff_ticket_refunded', 'Ticket refunded'],
		['staff_series_pass_purchased', 'Series pass sold'],
		['staff_series_pass_cancelled', 'Series pass cancelled']
	] as const)('translates %s (BE #1130)', (type, label) => {
		expect(hasNotificationTypeLabel(type)).toBe(true);
		expect(getNotificationTypeLabel(type, 'en')).toBe(label);
		expect(getNotificationTypeDescription(type, 'en')).toBeTruthy();
	});

	it('falls back to the raw name for unknown types the API may send', () => {
		expect(hasNotificationTypeLabel('future_unknown_type')).toBe(false);
		expect(getNotificationTypeLabel('future_unknown_type')).toBe('future unknown type');
		expect(getNotificationTypeDescription('future_unknown_type')).toBeUndefined();
	});

	it('ignores prototype keys a stray type string could collide with', () => {
		expect(hasNotificationTypeLabel('toString')).toBe(false);
		expect(getNotificationTypeLabel('toString')).toBe('toString');
		expect(getNotificationTypeDescription('constructor')).toBeUndefined();
	});

	it('covers every NotificationType with a label', () => {
		expect(ALL_TYPES.length).toBe(66);
		for (const type of ALL_TYPES) {
			expect(hasNotificationTypeLabel(type), type).toBe(true);
			expect(getNotificationTypeLabel(type, 'en').length, type).toBeGreaterThan(0);
			// A translated label, never the raw enum value.
			expect(getNotificationTypeLabel(type, 'en'), type).not.toBe(type);
		}
	});

	it.each(LOCALES)('labels are unique across all types in %s', (locale: Locale) => {
		const labels = ALL_TYPES.map((type) => getNotificationTypeLabel(type, locale));
		const duplicates = labels.filter((label, i) => labels.indexOf(label) !== i);
		expect(duplicates).toEqual([]);
	});

	it('keeps staff variants distinct from their attendee twins', () => {
		for (const locale of LOCALES) {
			const pairs: [NotificationType, NotificationType][] = [
				['staff_ticket_cancelled', 'ticket_cancelled'],
				['staff_ticket_refunded', 'ticket_refunded'],
				['staff_series_pass_purchased', 'series_pass_purchased'],
				['staff_series_pass_cancelled', 'series_pass_cancelled']
			];
			for (const [staff, attendee] of pairs) {
				expect(getNotificationTypeLabel(staff, locale)).not.toBe(
					getNotificationTypeLabel(attendee, locale)
				);
			}
		}
	});
});
