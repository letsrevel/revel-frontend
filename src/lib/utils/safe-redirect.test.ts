import { describe, it, expect } from 'vitest';
import { safeReturnUrl } from './safe-redirect';

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
