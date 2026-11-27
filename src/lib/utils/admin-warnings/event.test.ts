import { describe, expect, it } from 'vitest';
import {
	checkInAfterEndWarning,
	eventDeadlineWarnings,
	guestFullProfileWarning,
	guestNeedsInvitationWarning,
	hiddenOpenEventWarning,
	invitationRequestsIgnoredWarning,
	invitationRequestsOffWarning,
	limitAboveVenueWarning,
	noTicketsOnSaleWarning,
	parseWarningDate,
	rsvpAfterEndWarning,
	rsvpOnTicketedWarning,
	applyAfterEndWarning,
	tiersExceedCapacityWarning,
	waitlistWithoutCapacityWarning
} from './event';

describe('B1 invitation requests off', () => {
	it('fires for a public listing of a private event without requests', () => {
		const w = invitationRequestsOffWarning({
			visibility: 'public',
			event_type: 'private',
			accept_invitation_requests: false
		});
		expect(w?.id).toBe('B1');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Private event is visible to everyone');
		expect(w?.message()).toContain('Visitors cannot request an invitation');
	});
	it('does not fire when requests are on', () => {
		expect(
			invitationRequestsOffWarning({
				visibility: 'public',
				event_type: 'private',
				accept_invitation_requests: true
			})
		).toBeNull();
	});
	it('treats an unset flag as off and ignores other visibilities', () => {
		expect(invitationRequestsOffWarning({ visibility: 'public', event_type: 'private' })?.id).toBe(
			'B1'
		);
		expect(
			invitationRequestsOffWarning({ visibility: 'unlisted', event_type: 'private' })
		).toBeNull();
	});
});

describe('B2 invitation requests ignored', () => {
	it('fires for a non-private event with requests on', () => {
		const w = invitationRequestsIgnoredWarning({
			event_type: 'public',
			accept_invitation_requests: true
		});
		expect(w?.id).toBe('B2');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Invitation requests need a private event');
		expect(w?.message()).toContain('private event');
	});
	it('does not fire for a private event', () => {
		expect(
			invitationRequestsIgnoredWarning({ event_type: 'private', accept_invitation_requests: true })
		).toBeNull();
	});
	it('fires for members-only and not when the flag is off', () => {
		expect(
			invitationRequestsIgnoredWarning({
				event_type: 'members-only',
				accept_invitation_requests: true
			})?.id
		).toBe('B2');
		expect(
			invitationRequestsIgnoredWarning({ event_type: 'public', accept_invitation_requests: false })
		).toBeNull();
	});
});

describe('B4 hidden open event', () => {
	it.each(['private', 'staff-only'])('fires for %s visibility', (visibility) => {
		const w = hiddenOpenEventWarning({ visibility, status: 'open', event_type: 'public' });
		expect(w?.id).toBe('B4');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Open event is hidden from most people');
		expect(w?.message()).toContain('visibility is limited');
	});
	it('does not fire for a draft', () => {
		expect(
			hiddenOpenEventWarning({ visibility: 'private', status: 'draft', event_type: 'public' })
		).toBeNull();
	});
	it('does not fire without status (create mode) or for a private event type', () => {
		expect(hiddenOpenEventWarning({ visibility: 'private', event_type: 'public' })).toBeNull();
		expect(
			hiddenOpenEventWarning({ visibility: 'private', status: 'open', event_type: 'private' })
		).toBeNull();
		expect(
			hiddenOpenEventWarning({ visibility: 'public', status: 'open', event_type: 'public' })
		).toBeNull();
	});
});

describe('B5a guest full profile', () => {
	it('fires when guests need a full profile', () => {
		const w = guestFullProfileWarning({
			can_attend_without_login: true,
			requires_full_profile: true
		});
		expect(w?.id).toBe('B5a');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Guest checkout always fails');
		expect(w?.message()).toContain('full profile');
	});
	it('does not fire for either flag alone', () => {
		expect(
			guestFullProfileWarning({ can_attend_without_login: true, requires_full_profile: false })
		).toBeNull();
		expect(
			guestFullProfileWarning({ can_attend_without_login: false, requires_full_profile: true })
		).toBeNull();
	});
	it('treats null flags as off', () => {
		expect(
			guestFullProfileWarning({ can_attend_without_login: null, requires_full_profile: null })
		).toBeNull();
	});
});

describe('B5b guests need an invitation link', () => {
	it.each(['private', 'members-only'])('fires for a %s event', (event_type) => {
		const w = guestNeedsInvitationWarning({ can_attend_without_login: true, event_type });
		expect(w?.id).toBe('B5b');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Guests need an invitation link');
		expect(w?.message()).toContain('invitation link');
	});
	it('fires for a published admission questionnaire on a public event', () => {
		expect(
			guestNeedsInvitationWarning({
				can_attend_without_login: true,
				event_type: 'public',
				questionnaires: [{ questionnaire_type: 'admission', status: 'published' }]
			})?.id
		).toBe('B5b');
	});
	it('ignores draft, non-admission and absent questionnaires', () => {
		const base = { can_attend_without_login: true, event_type: 'public' };
		expect(
			guestNeedsInvitationWarning({
				...base,
				questionnaires: [
					{ questionnaire_type: 'admission', status: 'draft' },
					{ questionnaire_type: 'feedback', status: 'published' }
				]
			})
		).toBeNull();
		expect(guestNeedsInvitationWarning(base)).toBeNull();
	});
	it('does not fire when guests cannot attend anyway', () => {
		expect(
			guestNeedsInvitationWarning({ can_attend_without_login: false, event_type: 'private' })
		).toBeNull();
	});
});

describe('C1 waitlist without capacity', () => {
	it('fires when the waitlist is open and nothing caps the event', () => {
		const w = waitlistWithoutCapacityWarning({ waitlist_open: true });
		expect(w?.id).toBe('C1');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('The waitlist cannot be joined');
		expect(w?.message()).toContain('no capacity limit');
	});
	it('treats 0 as unset', () => {
		expect(
			waitlistWithoutCapacityWarning({ waitlist_open: true, max_attendees: 0, venueCapacity: 0 })
		).not.toBeNull();
	});
	it('does not fire with a max or a venue capacity, or a closed waitlist', () => {
		expect(waitlistWithoutCapacityWarning({ waitlist_open: true, max_attendees: 50 })).toBeNull();
		expect(waitlistWithoutCapacityWarning({ waitlist_open: true, venueCapacity: 80 })).toBeNull();
		expect(waitlistWithoutCapacityWarning({ waitlist_open: false })).toBeNull();
	});
});

describe('C2 deadlines after the event end', () => {
	const end = '2030-06-01T20:00:00Z';
	it('check-in start after check-in end', () => {
		const input = {
			end,
			check_in_starts_at: '2030-06-01T19:00:00Z',
			check_in_ends_at: '2030-06-01T18:00:00Z'
		};
		const w = checkInAfterEndWarning(input);
		expect(w?.id).toBe('C2-checkin');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Check-in opens after the event ends');
		expect(w?.message()).toContain('Nobody can check in');
	});
	it('check-in start after the event end when no check-in end is set', () => {
		expect(
			checkInAfterEndWarning({
				end,
				check_in_starts_at: '2030-06-01T21:00:00Z',
				check_in_ends_at: ''
			})?.id
		).toBe('C2-checkin');
	});
	it('a check-in end after the event end is fine (functional)', () => {
		expect(
			checkInAfterEndWarning({
				end,
				check_in_starts_at: '2030-06-01T19:00:00Z',
				check_in_ends_at: '2030-06-01T23:00:00Z'
			})
		).toBeNull();
	});
	it('check-in start before the end does not fire; equal does not fire', () => {
		expect(checkInAfterEndWarning({ end, check_in_starts_at: '2030-06-01T18:00:00Z' })).toBeNull();
		expect(checkInAfterEndWarning({ end, check_in_starts_at: end })).toBeNull();
	});
	it('rsvp_before and apply_before after the end', () => {
		const w = rsvpAfterEndWarning({ end, rsvp_before: '2030-06-02T00:00:00Z' });
		expect(w?.id).toBe('C2-rsvp');
		expect(w?.title()).toBe('RSVP deadline is after the event ends');
		const a = applyAfterEndWarning({ end, apply_before: '2030-06-02T00:00:00Z' });
		expect(a?.id).toBe('C2-apply');
		expect(a?.title()).toBe('Application deadline is after the event ends');
		expect(a?.message()).toContain('application deadline is later than the event end');
		expect(rsvpAfterEndWarning({ end, rsvp_before: '2030-06-01T10:00:00Z' })).toBeNull();
		expect(applyAfterEndWarning({ end, apply_before: '2030-06-01T10:00:00Z' })).toBeNull();
	});
	it('skips open-ended events, missing end and empty or invalid dates', () => {
		const late = '2031-01-01T00:00:00Z';
		expect(
			eventDeadlineWarnings({
				is_open_ended: true,
				end,
				rsvp_before: late,
				apply_before: late,
				check_in_starts_at: late
			})
		).toEqual([]);
		expect(eventDeadlineWarnings({ end: null, rsvp_before: late })).toEqual([]);
		expect(eventDeadlineWarnings({ end: '', rsvp_before: late })).toEqual([]);
		expect(eventDeadlineWarnings({ end, rsvp_before: '', apply_before: 'garbage' })).toEqual([]);
	});
	it('parses offset dates', () => {
		expect(
			rsvpAfterEndWarning({ end: '2030-06-01T20:00:00+02:00', rsvp_before: '2030-06-01T19:00:00Z' })
				?.id
		).toBe('C2-rsvp');
	});
	it('rsvp on a ticketed event fires without an end date', () => {
		const w = rsvpOnTicketedWarning({ requires_ticket: true, rsvp_before: '2030-05-01T00:00' });
		expect(w?.id).toBe('C2-rsvp-ticketed');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('RSVP deadline does not apply');
		expect(w?.message()).toContain('Clear the deadline');
		expect(rsvpOnTicketedWarning({ requires_ticket: true, rsvp_before: '' })).toBeNull();
		expect(rsvpOnTicketedWarning({ requires_ticket: false, rsvp_before: '2030-05-01' })).toBeNull();
	});
	it('collects all sub-warnings', () => {
		const ids = eventDeadlineWarnings({
			end,
			requires_ticket: true,
			check_in_starts_at: '2030-06-02T00:00:00Z',
			rsvp_before: '2030-06-02T00:00:00Z',
			apply_before: '2030-06-02T00:00:00Z'
		}).map((w) => w.id);
		expect(ids).toEqual(['C2-checkin', 'C2-rsvp', 'C2-apply', 'C2-rsvp-ticketed']);
	});
});

describe('C3a tiers exceed capacity', () => {
	it('fires when the sum is above the capacity', () => {
		const w = tiersExceedCapacityWarning({
			tiers: [{ total_quantity: 60 }, { total_quantity: 60 }],
			max_attendees: 100
		});
		expect(w?.id).toBe('C3a');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Tickets exceed the event capacity');
		expect(w?.message()).toContain('120 tickets');
		expect(w?.message()).toContain('100 people');
	});
	it('uses the smaller of max and venue capacity', () => {
		expect(
			tiersExceedCapacityWarning({
				tiers: [{ total_quantity: 60 }],
				max_attendees: 100,
				venueCapacity: 50
			})?.id
		).toBe('C3a');
	});
	it('skips unlimited tiers and does not fire at equal sum', () => {
		expect(
			tiersExceedCapacityWarning({
				tiers: [{ total_quantity: 100 }, { total_quantity: null }, {}],
				max_attendees: 100
			})
		).toBeNull();
	});
	it('does not fire for an uncapped event', () => {
		expect(tiersExceedCapacityWarning({ tiers: [{ total_quantity: 9999 }] })).toBeNull();
	});
});

describe('C3b limit above venue', () => {
	it('fires when max exceeds the venue capacity', () => {
		const w = limitAboveVenueWarning({ max_attendees: 200, venueCapacity: 100 });
		expect(w?.id).toBe('C3b');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Limit is above the venue capacity');
		expect(w?.message()).toContain('200');
		expect(w?.message()).toContain('100');
	});
	it('does not fire when equal, lower or either value is unset', () => {
		expect(limitAboveVenueWarning({ max_attendees: 100, venueCapacity: 100 })).toBeNull();
		expect(limitAboveVenueWarning({ max_attendees: 50, venueCapacity: 100 })).toBeNull();
		expect(limitAboveVenueWarning({ max_attendees: 50 })).toBeNull();
		expect(limitAboveVenueWarning({ venueCapacity: 50, max_attendees: null })).toBeNull();
	});
});

describe('C4 no tickets on sale', () => {
	const now = new Date('2030-06-01T12:00:00Z');
	const future = '2030-06-10T18:00:00Z';
	const past = '2030-05-01T00:00:00Z';
	const base = {
		status: 'open',
		requires_ticket: true,
		start: future,
		end: '2030-06-10T23:00:00Z',
		now
	};

	it('fires with no tiers', () => {
		const w = noTicketsOnSaleWarning({ ...base, tiers: [] });
		expect(w?.id).toBe('C4');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('No tickets are on sale');
		expect(w?.message()).toContain('no ticket tier is on sale');
	});
	it('does not fire for a tier without a window', () => {
		expect(noTicketsOnSaleWarning({ ...base, tiers: [{}] })).toBeNull();
	});
	it('a no-window tier is on sale even after the event start', () => {
		expect(
			noTicketsOnSaleWarning({
				...base,
				start: '2030-06-01T10:00:00Z',
				end: '2030-06-01T23:00:00Z',
				tiers: [{ sales_start_at: null, sales_end_at: '' }]
			})
		).toBeNull();
	});
	it('fires when every tier is paused', () => {
		expect(
			noTicketsOnSaleWarning({ ...base, tiers: [{ sales_paused: true }, { sales_paused: true }] })
				?.id
		).toBe('C4');
	});
	it('does not fire for a scheduled tier', () => {
		expect(
			noTicketsOnSaleWarning({ ...base, tiers: [{ sales_start_at: '2030-06-05T00:00:00Z' }] })
		).toBeNull();
	});
	it('does not count a scheduled tier whose start is after its effective end', () => {
		// start after the explicit sales end
		expect(
			noTicketsOnSaleWarning({
				...base,
				tiers: [{ sales_start_at: '2030-06-05T00:00:00Z', sales_end_at: '2030-06-04T00:00:00Z' }]
			})?.id
		).toBe('C4');
		// start after the event start (fallback end)
		expect(
			noTicketsOnSaleWarning({ ...base, tiers: [{ sales_start_at: '2030-06-11T00:00:00Z' }] })?.id
		).toBe('C4');
	});
	it('fires when the sales window has ended', () => {
		expect(
			noTicketsOnSaleWarning({
				...base,
				tiers: [{ sales_start_at: past, sales_end_at: '2030-05-20T00:00:00Z' }]
			})?.id
		).toBe('C4');
	});
	it('does not fire for a tier on sale inside its window', () => {
		expect(
			noTicketsOnSaleWarning({ ...base, tiers: [{ sales_start_at: past, sales_end_at: future }] })
		).toBeNull();
	});
	it('falls back to the event start when sales_end_at is unset', () => {
		expect(noTicketsOnSaleWarning({ ...base, tiers: [{ sales_start_at: past }] })).toBeNull();
		// event started, still running: a start-only tier is off sale
		expect(
			noTicketsOnSaleWarning({
				...base,
				start: '2030-06-01T10:00:00Z',
				end: '2030-06-01T23:00:00Z',
				tiers: [{ sales_start_at: past }]
			})?.id
		).toBe('C4');
	});
	it('one on-sale tier is enough among paused ones', () => {
		expect(noTicketsOnSaleWarning({ ...base, tiers: [{ sales_paused: true }, {}] })).toBeNull();
	});
	it('skips a past event', () => {
		expect(
			noTicketsOnSaleWarning({
				...base,
				start: '2030-05-01T10:00:00Z',
				end: '2030-05-01T20:00:00Z',
				tiers: []
			})
		).toBeNull();
	});
	it('uses the start when there is no end', () => {
		expect(
			noTicketsOnSaleWarning({ ...base, start: '2030-05-01T10:00:00Z', end: null, tiers: [] })
		).toBeNull();
	});
	it('skips non-open status and events without tickets', () => {
		expect(noTicketsOnSaleWarning({ ...base, status: 'draft', tiers: [] })).toBeNull();
		expect(noTicketsOnSaleWarning({ ...base, status: undefined, tiers: [] })).toBeNull();
		expect(noTicketsOnSaleWarning({ ...base, requires_ticket: false, tiers: [] })).toBeNull();
	});
});

describe('parseWarningDate', () => {
	it('treats empty, null and invalid as unset', () => {
		expect(parseWarningDate('')).toBeNull();
		expect(parseWarningDate(null)).toBeNull();
		expect(parseWarningDate(undefined)).toBeNull();
		expect(parseWarningDate('nope')).toBeNull();
		expect(parseWarningDate('2030-06-01T20:00:00Z')).toBe(Date.parse('2030-06-01T20:00:00Z'));
	});
});
