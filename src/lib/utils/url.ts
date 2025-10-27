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
