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
});
