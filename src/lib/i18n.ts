/**
 * i18n Configuration for SvelteKit
 *
 * This file provides utilities for language detection and management.
 */

import { setLocale, getLocale, locales, baseLocale } from '$lib/paraglide/runtime.js';
import type { Handle } from '@sveltejs/kit';

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [...locales];

/**
 * Default language
 */
export const DEFAULT_LANGUAGE = baseLocale;

/**
 * Detect language from various sources
 * Priority: URL param > Cookie > Accept-Language header > Default
 */
function detectLanguage(event: Parameters<Handle>[0]['event']): string {
	// 1. Check URL parameter
	const urlLang = event.url.searchParams.get('lang');
	if (urlLang && SUPPORTED_LANGUAGES.includes(urlLang as any)) {
		return urlLang;
	}

	// 2. Check cookie
	const cookieLang = event.cookies.get('user_language');
	if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang as any)) {
		return cookieLang;
	}

	// 3. Check Accept-Language header
	const acceptLanguage = event.request.headers.get('accept-language');
	if (acceptLanguage) {
		const lang = acceptLanguage.split(',')[0]?.split('-')[0];
		if (lang && SUPPORTED_LANGUAGES.includes(lang as any)) {
			return lang;
		}
	}

	// 4. Default
	return DEFAULT_LANGUAGE;
}

/**
 * i18n hook for SvelteKit
 */
export function i18nHandle(): Handle {
	return async ({ event, resolve }) => {
		const lang = detectLanguage(event);

		// Set the locale for this request
		setLocale(lang as any);

		// Store language in cookie for persistence
		event.cookies.set('user_language', lang, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			sameSite: 'lax',
			httpOnly: false // Allow client-side access
		});

		// Resolve with lang attribute replacement
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html
					.replace('%paraglide.lang%', lang)
					.replace('%paraglide.textDirection%', 'ltr'); // All our languages are LTR
			}
		});
	};
}

/**
 * Export language utilities
 */
export { setLocale, getLocale, locales, baseLocale };
