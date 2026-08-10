import { describe, it, expect } from 'vitest';
import { detectWalletPlatform } from './platform';

const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA =
	'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const MAC_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('detectWalletPlatform', () => {
	it('detects Android', () => {
		expect(detectWalletPlatform(ANDROID_UA)).toBe('android');
	});

	it('detects iPhone and iPad', () => {
		expect(detectWalletPlatform(IPHONE_UA)).toBe('ios');
		expect(detectWalletPlatform(IPAD_UA)).toBe('ios');
	});

	it('treats desktop as other', () => {
		// jsdom's navigator has maxTouchPoints 0, so the iPadOS-as-Mac branch
		// stays off for a plain Macintosh UA.
		expect(detectWalletPlatform(MAC_UA)).toBe('other');
		expect(detectWalletPlatform(WINDOWS_UA)).toBe('other');
	});

	it('returns other for an empty UA', () => {
		expect(detectWalletPlatform('')).toBe('other');
	});
});
