import { describe, it, expect } from 'vitest';
import { oidcErrorMessage } from './oidc-errors';

const KNOWN_CODES = [
	'oidc_denied',
	'oidc_state',
	'oidc_provider',
	'oidc_unverified_email',
	'oidc_no_email',
	'oidc_banned',
	'oidc_inactive'
];

describe('oidcErrorMessage', () => {
	it('maps every documented code to a non-empty message', () => {
		const messages = KNOWN_CODES.map((code) => oidcErrorMessage(code));
		for (const message of messages) {
			expect(message).toBeTruthy();
		}
		// every code gets its own message, not one shared string
		expect(new Set(messages).size).toBe(KNOWN_CODES.length);
	});

	it('falls back to a generic message for unknown oidc_* codes', () => {
		expect(oidcErrorMessage('oidc_mystery')).toBeTruthy();
	});

	it('ignores non-OIDC error params', () => {
		expect(oidcErrorMessage(null)).toBeNull();
		expect(oidcErrorMessage('')).toBeNull();
		expect(oidcErrorMessage('session_expired')).toBeNull();
	});
});
