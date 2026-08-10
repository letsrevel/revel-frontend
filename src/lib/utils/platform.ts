/**
 * Coarse mobile-wallet platform detection, used ONLY to order the wallet
 * buttons (Google first on Android, Apple first on iOS/desktop) — never to
 * hide either rail.
 */
export type WalletPlatform = 'android' | 'ios' | 'other';

export function detectWalletPlatform(userAgent?: string): WalletPlatform {
	const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
	if (/android/i.test(ua)) return 'android';
	if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
	// iPadOS 13+ reports itself as a Mac; a Mac with multitouch is an iPad.
	if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
		return 'ios';
	}
	return 'other';
}
