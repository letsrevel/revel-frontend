import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { rsvpCreateErrorMessage } from './rsvp-create-error';

describe('rsvpCreateErrorMessage', () => {
	it('shows the translated advice for invitation_required, ignoring the detail text', () => {
		const message = rsvpCreateErrorMessage({
			code: 'invitation_required',
			detail: 'Something else entirely'
		});
		expect(message).toBe(m['attendeesAdmin.invitationRequired']());
		expect(message).toMatch(/invite/i);
		expect(message).not.toContain('Something else');
	});

	it('does not treat the phrase in a detail as the code', () => {
		expect(rsvpCreateErrorMessage({ detail: 'invitation_required' })).toBe('invitation_required');
	});

	it('falls back to the server detail, then to the generic message', () => {
		expect(rsvpCreateErrorMessage({ detail: 'Event is full' })).toBe('Event is full');
		expect(rsvpCreateErrorMessage(undefined)).toBe(m['attendeesAdmin.createError']());
	});
});
