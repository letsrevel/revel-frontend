import { describe, it, expect } from 'vitest';
import { safeReturnUrl, registrationReturnUrl, withReturnUrl } from './safe-redirect';

describe('safeReturnUrl', () => {
	it('accepts genuine relative paths', () => {
		expect(safeReturnUrl('/dashboard')).toBe('/dashboard');
		expect(safeReturnUrl('/org/acme/admin/members')).toBe('/org/acme/admin/members');
		expect(safeReturnUrl('/account/notifications?tab=email')).toBe(
			'/account/notifications?tab=email'
		);
	});

	it('rejects absolute URLs', () => {
		expect(safeReturnUrl('https://evil.com')).toBe('/dashboard');
		expect(safeReturnUrl('http://evil.com/path')).toBe('/dashboard');
	});

	it('rejects protocol-relative and backslash variants', () => {
		expect(safeReturnUrl('//evil.com')).toBe('/dashboard');
		expect(safeReturnUrl('/\\evil.com')).toBe('/dashboard');
	});

	it('rejects non-path schemes and non-relative values', () => {
		expect(safeReturnUrl('javascript:alert(1)')).toBe('/dashboard');
		expect(safeReturnUrl('dashboard')).toBe('/dashboard');
	});

	it('falls back for empty / nullish input', () => {
		expect(safeReturnUrl(null)).toBe('/dashboard');
		expect(safeReturnUrl(undefined)).toBe('/dashboard');
		expect(safeReturnUrl('')).toBe('/dashboard');
	});

	it('uses a custom fallback when provided', () => {
		expect(safeReturnUrl(null, '/')).toBe('/');
		expect(safeReturnUrl('//evil.com', '/home')).toBe('/home');
	});
});

describe('registrationReturnUrl', () => {
	it('returns a genuine relative path unchanged', () => {
		expect(registrationReturnUrl('/account/memberships')).toBe('/account/memberships');
		expect(
			registrationReturnUrl(
				'/oauth/authorize?client_id=x&resource=a&resource=b&redirect_uri=https%3A%2F%2Fx'
			)
		).toBe('/oauth/authorize?client_id=x&resource=a&resource=b&redirect_uri=https%3A%2F%2Fx');
	});

	it('keeps an already-encoded protocol-relative path (harmless once-decoded)', () => {
		expect(registrationReturnUrl('/%2F%2Fevil')).toBe('/%2F%2Fevil');
	});

	it('rejects everything safeReturnUrl rejects', () => {
		expect(registrationReturnUrl('https://evil.com')).toBeNull();
		expect(registrationReturnUrl('//evil.com')).toBeNull();
		expect(registrationReturnUrl('/\\evil.com')).toBeNull();
		expect(registrationReturnUrl('dashboard')).toBeNull();
		expect(registrationReturnUrl(null)).toBeNull();
		expect(registrationReturnUrl(undefined)).toBeNull();
		expect(registrationReturnUrl('')).toBeNull();
	});

	it('rejects values the backend regex refuses: whitespace, control chars, over-long', () => {
		expect(registrationReturnUrl('/a b')).toBeNull();
		expect(registrationReturnUrl('/a\tb')).toBeNull();
		expect(registrationReturnUrl('/a\nb')).toBeNull();
		expect(registrationReturnUrl('/a\u0000b')).toBeNull();
		expect(registrationReturnUrl('/a\u007fb')).toBeNull();
		expect(registrationReturnUrl('/a\u0085b')).toBeNull();
		expect(registrationReturnUrl('/' + 'x'.repeat(2048))).toBeNull(); // 2049 chars
		expect(registrationReturnUrl('/' + 'x'.repeat(2047))).toHaveLength(2048);
	});
});

describe('withReturnUrl', () => {
	it('appends an encoded returnUrl to a bare href', () => {
		expect(withReturnUrl('/register', '/oauth/authorize?a=1&b=2')).toBe(
			'/register?returnUrl=%2Foauth%2Fauthorize%3Fa%3D1%26b%3D2'
		);
	});

	it('returns the href unchanged for missing or unsafe values', () => {
		expect(withReturnUrl('/register', null)).toBe('/register');
		expect(withReturnUrl('/register', undefined)).toBe('/register');
		expect(withReturnUrl('/register', '')).toBe('/register');
		expect(withReturnUrl('/register', 'https://evil.com')).toBe('/register');
		expect(withReturnUrl('/register', '//evil.com')).toBe('/register');
	});
});
