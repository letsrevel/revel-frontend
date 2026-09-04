import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './guestAttendance';

describe('extractErrorMessage', () => {
	// The @hey-api client resolves non-2xx as { error } where `error` IS the
	// parsed body — no `.body` wrapper. Both shapes must extract.
	it('reads a top-level detail (hey-api response.error shape)', () => {
		expect(extractErrorMessage({ detail: 'Tier not allowed.' })).toBe('Tier not allowed.');
	});

	it('reads a top-level eligibility reason', () => {
		expect(extractErrorMessage({ allowed: false, reason: 'Questionnaire required.' })).toBe(
			'Questionnaire required.'
		);
	});

	it('still reads detail/reason under a body wrapper', () => {
		expect(extractErrorMessage({ body: { detail: 'Wrapped detail.' } })).toBe('Wrapped detail.');
		expect(extractErrorMessage({ body: { reason: 'Wrapped reason.' } })).toBe('Wrapped reason.');
	});

	it('still reads an Error message', () => {
		expect(extractErrorMessage(new Error('Boom'))).toBe('Boom');
	});

	// The full backend error vocabulary (api-error-detail.ts): django-ninja's
	// request-validation 422 ships `detail` as a LIST, and model validation
	// ships `{ errors: { field: [...] } }` — both must surface readable text,
	// not fall through to the generic network-error copy.
	it('reads the 422 request-validation list-shaped detail', () => {
		expect(
			extractErrorMessage({ detail: [{ msg: 'Email required' }, { msg: 'Name required' }] })
		).toBe('Email required, Name required');
	});

	it('reads a ValidationErrorResponse errors map', () => {
		expect(extractErrorMessage({ errors: { email: ['Invalid email'] } })).toBe('Invalid email');
	});

	it('prefers the localized reason_code copy for an eligibility refusal', () => {
		expect(
			extractErrorMessage({
				allowed: false,
				event_id: 'event-1',
				reason_code: 'membership_tier_required',
				reason: 'raw backend prose'
			})
		).toBe('This ticket is reserved for specific membership tiers.');
	});
});
