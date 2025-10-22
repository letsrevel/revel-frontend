import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Converts a relative backend URL path to a full URL.
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

	// If path is already a full URL, return it as-is
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return path;
	}

	// Otherwise, prepend backend URL
	// Ensure no double slashes if path already starts with /
	const cleanPath = path.startsWith('/') ? path : `/${path}`;
	return `${PUBLIC_API_URL}${cleanPath}`;
}

/**
 * Alias for getBackendUrl for semantic clarity when dealing with images
 */
export const getImageUrl = getBackendUrl;
