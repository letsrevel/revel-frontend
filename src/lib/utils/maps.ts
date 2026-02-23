/**
 * Allowed hostnames for map embed iframes.
 * Only trusted map providers should be listed here.
 */
const ALLOWED_EMBED_HOSTS = [
	'www.google.com',
	'google.com',
	'maps.google.com',
	'www.openstreetmap.org',
	'openstreetmap.org',
	'www.bing.com',
	'bing.com',
	'maps.app.goo.gl',
	'goo.gl',
	'yandex.com',
	'yandex.ru',
	'map.baidu.com'
];

/**
 * Validates that a URL is a safe map embed URL.
 * Returns the URL if valid, or null if it fails validation.
 *
 * Security checks:
 * - Must be a valid URL
 * - Must use https: scheme
 * - Must be from an allowed map provider domain
 */
export function sanitizeMapEmbedUrl(input: string | null | undefined): string | null {
	if (!input) return null;

	const trimmed = input.trim();
	if (!trimmed) return null;

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	if (url.protocol !== 'https:') {
		return null;
	}

	const hostname = url.hostname.toLowerCase();
	if (
		!ALLOWED_EMBED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith('.' + allowed))
	) {
		return null;
	}

	return url.toString();
}

/**
 * Extracts a map embed URL from either a raw URL or an iframe HTML snippet.
 * Applies security validation to the result.
 *
 * @returns A sanitized HTTPS URL from an allowed domain, or null.
 */
export function extractMapEmbedUrl(input: string | null | undefined): string | null {
	if (!input) return null;

	const trimmed = input.trim();
	if (!trimmed) return null;

	// If it starts with https, try it directly
	if (trimmed.startsWith('https://')) {
		return sanitizeMapEmbedUrl(trimmed);
	}

	// If it looks like an iframe, extract the src attribute
	if (trimmed.toLowerCase().startsWith('<iframe')) {
		const match = trimmed.match(/src=["']([^"']+)["']/);
		if (match?.[1]) {
			return sanitizeMapEmbedUrl(match[1]);
		}
	}

	// Reject anything else (javascript:, data:, http:, bare strings, etc.)
	return null;
}
