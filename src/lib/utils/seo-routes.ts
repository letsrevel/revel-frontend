/**
 * SEO Routes Utility
 *
 * Manages language-specific routing for hardcoded SEO landing pages.
 * These pages have static content in each language and can't use dynamic translations,
 * so we need to navigate to different URLs when switching languages.
 */

/**
 * List of SEO page slugs that have language-specific versions.
 * These pages exist at:
 * - English: /{slug}
 * - German: /de/{slug}
 * - Italian: /it/{slug}
 */
export const SEO_PAGE_SLUGS = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events',
	'community-first-event-platform'
] as const;

export type SeoPageSlug = (typeof SEO_PAGE_SLUGS)[number];

/**
 * Language prefixes for SEO routes.
 * English has no prefix (root), others have their language code.
 */
const LANGUAGE_PREFIXES: Record<string, string> = {
	en: '',
	de: '/de',
	it: '/it'
};

/**
 * Check if a pathname is an SEO landing page and extract its info.
 *
 * @param pathname - The current URL pathname (e.g., "/de/eventbrite-alternative")
 * @returns Object with slug and current language, or null if not an SEO page
 */
export function parseSeoRoute(pathname: string): { slug: SeoPageSlug; language: string } | null {
	// Remove trailing slash if present
	const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

	// Check for language-prefixed routes (e.g., /de/eventbrite-alternative)
	for (const [lang, prefix] of Object.entries(LANGUAGE_PREFIXES)) {
		if (prefix && normalizedPath.startsWith(prefix + '/')) {
			const slug = normalizedPath.slice(prefix.length + 1);
			if (SEO_PAGE_SLUGS.includes(slug as SeoPageSlug)) {
				return { slug: slug as SeoPageSlug, language: lang };
			}
		}
	}

	// Check for English (root) routes (e.g., /eventbrite-alternative)
	const slug = normalizedPath.slice(1); // Remove leading slash
	if (SEO_PAGE_SLUGS.includes(slug as SeoPageSlug)) {
		return { slug: slug as SeoPageSlug, language: 'en' };
	}

	return null;
}

/**
 * Get the URL for an SEO page in a specific language.
 *
 * @param slug - The SEO page slug
 * @param targetLanguage - The target language code
 * @returns The URL path for the page in the target language
 */
export function getSeoPageUrl(slug: SeoPageSlug, targetLanguage: string): string {
	const prefix = LANGUAGE_PREFIXES[targetLanguage] ?? '';
	return `${prefix}/${slug}`;
}

/**
 * Get the URL to navigate to when switching languages on the current page.
 * If we're on an SEO page, returns the language-specific variant.
 * Otherwise, returns null (language switch doesn't require navigation).
 *
 * @param currentPathname - The current URL pathname
 * @param targetLanguage - The language to switch to
 * @returns The URL to navigate to, or null if no navigation needed
 */
export function getLanguageSwitchUrl(
	currentPathname: string,
	targetLanguage: string
): string | null {
	const seoRoute = parseSeoRoute(currentPathname);

	if (seoRoute) {
		// We're on an SEO page - return the URL for the target language
		return getSeoPageUrl(seoRoute.slug, targetLanguage);
	}

	// Not an SEO page - no navigation needed (Paraglide handles it)
	return null;
}
