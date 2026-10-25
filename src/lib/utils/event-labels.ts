import * as m from '$lib/paraglide/messages.js';

/**
 * Translated label for an event's `event_type` enum value
 * (`public | private | members-only | staff-only`).
 */
export function formatEventTypeLabel(value: string): string {
	switch (value) {
		case 'public':
			return m['eventQuickInfo.publicEvent']();
		case 'private':
			return m['eventQuickInfo.privateEvent']();
		case 'members-only':
			return m['eventQuickInfo.membersOnly']();
		case 'staff-only':
			return m['eventQuickInfo.staffOnly']();
		default:
			return m['eventQuickInfo.event']();
	}
}

/**
 * Translated label for an event's `visibility` enum value
 * (`public | private | unlisted | members-only | staff-only`).
 */
export function formatVisibilityLabel(value: string): string {
	switch (value) {
		case 'public':
			return m['eventBadges.public']();
		case 'private':
			return m['eventBadges.private']();
		case 'unlisted':
			return m['eventBadges.unlisted']();
		case 'members-only':
			return m['eventBadges.membersOnly']();
		case 'staff-only':
			return m['eventQuickInfo.staffOnly']();
		case 'attendees-only':
			return m['eventBadges.attendeesOnly']();
		default:
			return value.replace(/-/g, ' ');
	}
}
