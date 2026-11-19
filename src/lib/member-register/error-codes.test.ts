import { describe, it, expect } from 'vitest';
import { errorCodeOf, isInvitationRequiredBody } from './error-codes';

describe('isInvitationRequiredBody', () => {
	it('matches the code, whatever the (translated) detail says', () => {
		expect(
			isInvitationRequiredBody({ code: 'invitation_required', detail: 'Konto unbekannt' })
		).toBe(true);
	});

	it('does not match other codes, plain details or malformed bodies', () => {
		expect(isInvitationRequiredBody({ code: 'already_member' })).toBe(false);
		expect(isInvitationRequiredBody({ detail: 'invitation_required' })).toBe(false);
		expect(isInvitationRequiredBody({ code: 42 })).toBe(false);
		expect(isInvitationRequiredBody(null)).toBe(false);
		expect(isInvitationRequiredBody(undefined)).toBe(false);
		expect(isInvitationRequiredBody('invitation_required')).toBe(false);
	});

	it('shares its validation with errorCodeOf', () => {
		expect(errorCodeOf({ code: 'x' })).toBe('x');
	});
});
