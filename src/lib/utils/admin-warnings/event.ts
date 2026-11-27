import * as m from '$lib/paraglide/messages.js';
import { effectiveEventCapacity } from '$lib/components/events/admin/event-capacity';
import type { AdminWarning } from './types';

export * from './event-schedule';

type Visibility = 'public' | 'unlisted' | 'private' | 'members-only' | 'staff-only';
type EventType = 'public' | 'private' | 'members-only';

/** B1 (warn): a public listing of an invite-only event with no way to ask for an invitation. */
export interface InvitationAccessInput {
	visibility?: Visibility | string | null;
	event_type?: EventType | string | null;
	accept_invitation_requests?: boolean | null;
}

export function invitationRequestsOffWarning(input: InvitationAccessInput): AdminWarning | null {
	if (
		input.visibility === 'public' &&
		input.event_type === 'private' &&
		!input.accept_invitation_requests
	) {
		return {
			id: 'B1',
			level: 'warn',
			title: () => m['adminWarnings.eventB1Title'](),
			message: () => m['adminWarnings.eventB1Message']()
		};
	}
	return null;
}

/** B2 (info): invitation requests are on, but the event is not private. */
export function invitationRequestsIgnoredWarning(
	input: InvitationAccessInput
): AdminWarning | null {
	if (input.accept_invitation_requests && input.event_type !== 'private') {
		return {
			id: 'B2',
			level: 'info',
			title: () => m['adminWarnings.eventB2Title'](),
			message: () => m['adminWarnings.eventB2Message']()
		};
	}
	return null;
}

/** B4 (info): an open public event that most people cannot see. `status` is saved state. */
export interface HiddenOpenEventInput {
	visibility?: Visibility | string | null;
	event_type?: EventType | string | null;
	status?: string | null;
}

export function hiddenOpenEventWarning(input: HiddenOpenEventInput): AdminWarning | null {
	if (
		(input.visibility === 'private' || input.visibility === 'staff-only') &&
		input.status === 'open' &&
		input.event_type === 'public'
	) {
		return {
			id: 'B4',
			level: 'info',
			title: () => m['adminWarnings.eventB4Title'](),
			message: () => m['adminWarnings.eventB4Message']()
		};
	}
	return null;
}

/** B5a (warn): guest checkout can never work when a full profile is required. */
export interface GuestAccessInput {
	can_attend_without_login?: boolean | null;
	requires_full_profile?: boolean | null;
	event_type?: EventType | string | null;
	/** Linked questionnaires; omit in create mode. */
	questionnaires?: ReadonlyArray<{ questionnaire_type?: string | null; status?: string | null }>;
}

export function guestFullProfileWarning(input: GuestAccessInput): AdminWarning | null {
	if (input.can_attend_without_login && input.requires_full_profile) {
		return {
			id: 'B5a',
			level: 'warn',
			title: () => m['adminWarnings.eventB5aTitle'](),
			message: () => m['adminWarnings.eventB5aMessage']()
		};
	}
	return null;
}

/** B5b (info): guests need an invitation link for private/members-only events or admission questionnaires. */
export function guestNeedsInvitationWarning(input: GuestAccessInput): AdminWarning | null {
	if (!input.can_attend_without_login) return null;
	const gatedType = input.event_type === 'private' || input.event_type === 'members-only';
	const gatedByQuestionnaire = (input.questionnaires ?? []).some(
		(q) => q.questionnaire_type === 'admission' && q.status === 'published'
	);
	if (!gatedType && !gatedByQuestionnaire) return null;
	return {
		id: 'B5b',
		level: 'info',
		title: () => m['adminWarnings.eventB5bTitle'](),
		message: () => m['adminWarnings.eventB5bMessage']()
	};
}

/** C1 (warn): the waitlist is open but the event has no capacity, so nobody can join it. */
export interface WaitlistInput {
	waitlist_open?: boolean | null;
	max_attendees?: number | null;
	venueCapacity?: number | null;
}

export function waitlistWithoutCapacityWarning(input: WaitlistInput): AdminWarning | null {
	if (
		input.waitlist_open &&
		effectiveEventCapacity(input.max_attendees, input.venueCapacity) === null
	) {
		return {
			id: 'C1',
			level: 'warn',
			title: () => m['adminWarnings.eventC1Title'](),
			message: () => m['adminWarnings.eventC1Message']()
		};
	}
	return null;
}

/** C3a (info): tier quantities add up to more than the event capacity. Unlimited tiers are skipped. */
export interface TierQuantityInput {
	total_quantity?: number | null;
}

export function tiersExceedCapacityWarning(input: {
	tiers: ReadonlyArray<TierQuantityInput>;
	max_attendees?: number | null;
	venueCapacity?: number | null;
	/** True when `tiers` is only the first page: the sum is then a lower bound ("at least"). */
	partial?: boolean;
}): AdminWarning | null {
	const capacity = effectiveEventCapacity(input.max_attendees, input.venueCapacity);
	if (capacity === null) return null;
	const tickets = input.tiers.reduce(
		(sum, t) =>
			typeof t.total_quantity === 'number' && Number.isFinite(t.total_quantity)
				? sum + t.total_quantity
				: sum,
		0
	);
	if (tickets <= capacity) return null;
	return {
		id: 'C3a',
		level: 'info',
		title: () => m['adminWarnings.eventC3aTitle'](),
		message: () =>
			input.partial
				? m['adminWarnings.eventC3aMessagePartial']({ tickets, capacity })
				: m['adminWarnings.eventC3aMessage']({ tickets, capacity })
	};
}

/** C3b (info): the attendee limit is above the venue capacity. */
export function limitAboveVenueWarning(input: {
	max_attendees?: number | null;
	venueCapacity?: number | null;
}): AdminWarning | null {
	const max = input.max_attendees;
	const capacity = input.venueCapacity;
	if (!max || !capacity || max <= capacity) return null;
	return {
		id: 'C3b',
		level: 'info',
		title: () => m['adminWarnings.eventC3bTitle'](),
		message: () => m['adminWarnings.eventC3bMessage']({ max, capacity })
	};
}
