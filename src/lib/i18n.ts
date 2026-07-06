/**
 * i18n Configuration for SvelteKit
 *
 * This file provides utilities for language detection and management.
 */

import {
	setLocale,
	getLocale,
	locales,
	baseLocale,
	cookieName,
	type Locale
} from '$lib/paraglide/runtime.js';
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
 * Type guard: is the given string one of the supported locales?
 */
function isSupportedLanguage(lang: string): lang is Locale {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Detect language from various sources
 * Priority: URL param > Cookie > Accept-Language header > Default
 */
function detectLanguage(event: Parameters<Handle>[0]['event']): Locale {
	// 1. Check URL parameter
	const urlLang = event.url.searchParams.get('lang');
	if (urlLang && isSupportedLanguage(urlLang)) {
		return urlLang;
	}

	// 2. Check Paraglide's canonical locale cookie.
	// This is the cookie the client-side Paraglide runtime resolves from
	// (written by setLocale() on the client), so honouring it here keeps the
	// server and client on the same locale.
	const paraglideCookie = event.cookies.get(cookieName);
	if (paraglideCookie && isSupportedLanguage(paraglideCookie)) {
		return paraglideCookie;
	}

	// 3. Check legacy user_language cookie
	const cookieLang = event.cookies.get('user_language');
	if (cookieLang && isSupportedLanguage(cookieLang)) {
		return cookieLang;
	}

	// 4. Check Accept-Language header
	const acceptLanguage = event.request.headers.get('accept-language');
	if (acceptLanguage) {
		const lang = acceptLanguage.split(',')[0]?.split('-')[0];
		if (lang && isSupportedLanguage(lang)) {
			return lang;
		}
	}

	// 5. Default
	return DEFAULT_LANGUAGE;
}

/**
 * i18n hook for SvelteKit
 */
export function i18nHandle(): Handle {
	return async ({ event, resolve }) => {
		const lang = detectLanguage(event);

		// Set the locale for this request
		setLocale(lang);

		const cookieOptions = {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			sameSite: 'lax',
			httpOnly: false // Allow client-side access
		} as const;

		// Write Paraglide's canonical locale cookie so the client-side runtime
		// resolves the SAME locale during hydration. Without this the client falls
		// back to baseLocale and the whole UI flashes to English on first visit
		// (the server's own setLocale() does not write this cookie). See #505.
		event.cookies.set(cookieName, lang, cookieOptions);

		// Keep the legacy cookie for backwards compatibility / explicit reads.
		event.cookies.set('user_language', lang, cookieOptions);

		// Resolve with lang attribute replacement
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%paraglide.lang%', lang).replace('%paraglide.textDirection%', 'ltr'); // All our languages are LTR
			}
		});
	};
}

/**
 * Export language utilities
 */
export { setLocale, getLocale, locales, baseLocale };
