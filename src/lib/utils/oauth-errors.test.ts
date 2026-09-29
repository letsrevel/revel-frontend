import { describe, it, expect } from 'vitest';
import {
	isConsentExpired,
	isOAuthErrorCode,
	oauthErrorHeadline,
	parseAuthorizationError
} from './oauth-errors';

const KNOWN_CODES = [
	'invalid_request',
	'unauthorized_client',
	'unsupported_response_type',
	'invalid_scope',
	'invalid_target',
	'server_error',
	'temporarily_unavailable',
	'invalid_client',
	'consent_required',
	'interaction_required'
];

describe('oauthErrorHeadline', () => {
	it('maps every documented code to its own non-empty headline', () => {
		const headlines = KNOWN_CODES.map((code) => oauthErrorHeadline(code));
		for (const headline of headlines) expect(headline).toBeTruthy();
		expect(new Set(headlines).size).toBe(KNOWN_CODES.length);
	});

	it('falls back to the generic headline for an unknown code (oauthlib passes any code through)', () => {
		const generic = oauthErrorHeadline('mystery_code');
		expect(generic).toBeTruthy();
		expect(KNOWN_CODES.map((c) => oauthErrorHeadline(c))).not.toContain(generic);
	});
});

describe('isOAuthErrorCode / isConsentExpired', () => {
	it('narrows known codes only', () => {
		expect(isOAuthErrorCode('invalid_scope')).toBe(true);
		expect(isOAuthErrorCode('access_denied')).toBe(false);
		expect(isOAuthErrorCode('')).toBe(false);
	});

	it('only consent_required means "show the screen again"', () => {
		expect(isConsentExpired('consent_required')).toBe(true);
		expect(isConsentExpired('invalid_request')).toBe(false);
	});
});

describe('parseAuthorizationError', () => {
	it('reads the {detail, error} body hey-api hands back as `error`', () => {
		expect(parseAuthorizationError({ detail: 'Bad scope.', error: 'invalid_scope' })).toEqual({
			code: 'invalid_scope',
			detail: 'Bad scope.'
		});
	});

	it('tolerates a missing detail', () => {
		expect(parseAuthorizationError({ error: 'server_error' })).toEqual({
			code: 'server_error',
			detail: ''
		});
	});

	it('returns null for anything that is not an authorization error body', () => {
		expect(parseAuthorizationError(null)).toBeNull();
		expect(parseAuthorizationError('invalid_scope')).toBeNull();
		expect(parseAuthorizationError({ detail: 'Not found.' })).toBeNull();
		expect(parseAuthorizationError({ error: '' })).toBeNull();
		expect(parseAuthorizationError({ error: 42 })).toBeNull();
	});
});
