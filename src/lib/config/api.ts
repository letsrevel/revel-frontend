/**
 * Centralized API Configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for all API-related URLs in the application.
 * All hardcoded URLs should be replaced with imports from this file.
 *
 * Configuration priority:
 * 1. PUBLIC_API_URL environment variable (from .env file via Vite)
 * 2. Fallback to localhost:8000 (development)
 *
 * @example
 * import { API_BASE_URL, getBackendUrl } from '$lib/config/api';
 *
 * // Use the base URL directly
 * const response = await fetch(`${API_BASE_URL}/api/events`);
 *
 * // Or use the helper to construct full URLs
 * const imageUrl = getBackendUrl('/media/logos/org.png');
 */

/**
 * Base URL for the backend API
 * This is the only place where the backend URL should be defined
 *
 * Note: PUBLIC_API_URL is injected by Vite from environment variables
 * It's replaced at build time with the actual value from .env
 */
export const API_BASE_URL: string = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get the full backend URL for a given path
 * If the path is already a full URL (starts with http:// or https://), return it as-is
 *
 * @param path - Relative path or full URL
 * @returns Full backend URL
 *
 * @example
 * getBackendUrl('/media/logos/org.png')
 * // => 'http://localhost:8000/media/logos/org.png'
 *
 * getBackendUrl('https://cdn.example.com/image.png')
 * // => 'https://cdn.example.com/image.png'
 */
export function getBackendUrl(path: string): string {
	// If it's already a full URL, return it as-is
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return path;
	}

	// Ensure the path starts with /
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;

	return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Get the API endpoint URL (with /api prefix)
 *
 * @param endpoint - API endpoint path (e.g., '/events' or 'events')
 * @returns Full API endpoint URL
 *
 * @example
 * getApiUrl('/events')
 * // => 'http://localhost:8000/api/events'
 *
 * getApiUrl('organization-admin/my-org/resources')
 * // => 'http://localhost:8000/api/organization-admin/my-org/resources'
 */
export function getApiUrl(endpoint: string): string {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	return `${API_BASE_URL}/api${normalizedEndpoint}`;
}

/**
 * Human-readable API base URL for display in error messages
 * Strips protocol for cleaner display
 *
 * @example
 * API_BASE_URL_DISPLAY
 * // => 'localhost:8000'
 */
export const API_BASE_URL_DISPLAY = API_BASE_URL.replace(/^https?:\/\//, '');
