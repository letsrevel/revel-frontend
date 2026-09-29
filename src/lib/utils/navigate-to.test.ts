import { describe, it, expect } from 'vitest';
import { isHttpUrl, navigateTo } from './navigate-to';

describe('isHttpUrl', () => {
	it('accepts absolute http(s) URLs and same-origin relative paths', () => {
		expect(isHttpUrl('https://app.example/callback?code=1')).toBe(true);
		expect(isHttpUrl('http://127.0.0.1:47123/callback')).toBe(true);
		expect(isHttpUrl('/login?returnUrl=%2Foauth%2Fauthorize')).toBe(true);
	});

	it('refuses other schemes and garbage', () => {
		expect(isHttpUrl('javascript:alert(1)')).toBe(false);
		expect(isHttpUrl('ftp://files.example/x')).toBe(false);
		expect(isHttpUrl('data:text/html,hi')).toBe(false);
		expect(isHttpUrl('')).toBe(false);
	});
});

describe('navigateTo', () => {
	it('throws instead of navigating to a non-http(s) URL', () => {
		expect(() => navigateTo('javascript:alert(1)')).toThrow(/refused/);
	});
});
