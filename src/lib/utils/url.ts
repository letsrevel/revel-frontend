import { getBackendUrl as getBackendUrlFromConfig } from '$lib/config/api';

/**
 * Converts a relative backend URL path to a full URL.
 * Re-exported from centralized API config for backwards compatibility.
 *
 * @param path - The path from the backend (e.g., "/media/logos/org.png")
 * @returns Full URL with backend domain, or null if path is null/undefined
 *
 * @example
 * getBackendUrl('/media/logos/org.png')
 * // => 'http://localhost:8000/media/logos/org.png'
 *
 * getBackendUrl('https://cdn.example.com/image.png')
 * // => 'https://cdn.example.com/image.png' (already full URL)
 *
 * getBackendUrl(null)
 * // => null
 */
export function getBackendUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	return getBackendUrlFromConfig(path);
}

/**
 * Alias for getBackendUrl for semantic clarity when dealing with images
 */
export const getImageUrl = getBackendUrl;

/**
 * Returns the normalized URL when the value parses as an absolute http(s) URL,
 * else null. Used to decide whether user-entered free text (e.g. a virtual
 * event's `address` holding a meeting link, #830) is safe to render as a
 * clickable anchor — everything else (javascript:, data:, relative paths,
 * plain street addresses) stays inert text.
 */
export function asHttpUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	return url.toString();
}
