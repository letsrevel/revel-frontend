/**
 * Error handling utilities for API errors
 *
 * Provides consistent error message extraction and handling across the application.
 */

/**
 * API error response format from backend
 */
interface ApiErrorResponse {
	detail?: string | Array<{ msg: string; type?: string }>;
	message?: string;
	error?: string;
	errors?: Record<string, string[]>;
}

/**
 * Extract a user-friendly error message from various error types
 *
 * Handles:
 * - API response errors (400, 500, etc.) with detail/message/error fields
 * - Network errors (offline, timeout, etc.)
 * - Generic JavaScript errors
 *
 * The auto-generated API client throws errors in this format:
 * - If error response is JSON: throws the parsed JSON object directly
 * - If error response is text: throws the text string
 * - May also include status code and other response metadata
 *
 * @param error - The error object (can be any type)
 * @param fallbackMessage - Optional custom fallback message
 * @returns A user-friendly error message
 */
export function extractErrorMessage(
	error: unknown,
	fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
	// Handle null/undefined
	if (!error) {
		return fallbackMessage;
	}

	// First, try to extract from plain object (most common for API errors)
	// The auto-generated API client throws the parsed JSON response body directly
	if (typeof error === 'object' && error !== null) {
		// Cast to our known API error response format
		const errorObj = error as ApiErrorResponse & {
			status?: number;
			statusText?: string;
			body?: ApiErrorResponse;
		};

		// Check for API error in body property (some wrappers put it here)
		if (errorObj.body) {
			const extracted = extractFromApiResponse(errorObj.body);
			if (extracted) return extracted;
		}

		// Try to extract from the object itself
		const extracted = extractFromApiResponse(errorObj);
		if (extracted) return extracted;

		// Check for HTTP status-based error messages
		if (errorObj.status) {
			const statusMessage = getStatusMessage(errorObj.status);
			if (statusMessage) return statusMessage;
		}
	}

	// Handle Error objects (wrapped errors from try-catch)
	if (error instanceof Error) {
		// Network errors
		if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
			return 'Network error. Please check your internet connection and try again.';
		}

		if (error.message.includes('timeout')) {
			return 'Request timed out. Please try again.';
		}

		// Return the error message if it looks user-friendly (not too long, not stack traces)
		if (error.message && error.message.length < 200 && !error.message.includes('\n')) {
			return error.message;
		}
	}

	// Handle string errors
	if (typeof error === 'string') {
		// Don't return very long strings (probably not user-friendly)
		if (error.length < 200) {
			return error;
		}
	}

	// Fallback
	return fallbackMessage;
}

/**
 * Extract per-field validation errors from an API error.
 *
 * Handles two shapes:
 * - Django/DRF-style: `{ errors: { field: ["msg1", "msg2"] } }`
 * - Pydantic detail array: `{ detail: [{ loc: [..., field], msg: "..." }, ...] }`
 *
 * Returns `[]` when no field-keyed errors are present so callers can fall back
 * to the generic message.
 */
export function extractFieldErrors(error: unknown): { field: string; messages: string[] }[] {
	if (!error || typeof error !== 'object') return [];

	const errorObj = error as ApiErrorResponse & {
		body?: ApiErrorResponse;
		detail?: string | Array<{ loc?: (string | number)[]; msg: string }>;
	};
	const source = errorObj.body ?? errorObj;

	const out: { field: string; messages: string[] }[] = [];

	if (source.errors && typeof source.errors === 'object') {
		for (const [field, messages] of Object.entries(source.errors)) {
			if (Array.isArray(messages) && messages.length > 0) {
				out.push({
					field,
					messages: messages.filter((m): m is string => typeof m === 'string')
				});
			}
		}
	}

	const detail = source.detail;
	if (Array.isArray(detail)) {
		const grouped = new Map<string, string[]>();
		for (const raw of detail) {
			const d = raw as { msg?: unknown; loc?: unknown };
			if (!d || typeof d !== 'object' || typeof d.msg !== 'string') continue;
			// loc is e.g. ["body", "refund_policy", "tiers", 0, "hours_before_event"]
			// Drop the "body" prefix that Pydantic adds, keep the rest as a dotted path.
			const loc = Array.isArray(d.loc)
				? d.loc.filter((p: unknown) => p !== 'body').map((p: unknown) => String(p))
				: [];
			const field = loc.join('.') || '_';
			const existing = grouped.get(field) ?? [];
			existing.push(d.msg);
			grouped.set(field, existing);
		}
		for (const [field, messages] of grouped) {
			out.push({ field, messages });
		}
	}

	return out;
}

/**
 * Get a user-friendly error message for an HTTP status code
 */
function getStatusMessage(status: number): string | null {
	const statusMessages: Record<number, string> = {
		400: 'Bad request. Please check your input and try again.',
		401: 'Unauthorized. Please log in and try again.',
		403: 'Forbidden. You do not have permission to perform this action.',
		404: 'Resource not found.',
		409: 'Conflict. This action conflicts with existing data.',
		410: 'This link is no longer valid. It may have expired or reached its usage limit.',
		422: 'Validation error. Please check your input.',
		429: 'Too many requests. Please wait a moment and try again.',
		500: 'Server error. Please try again later.',
		502: 'Server is temporarily unavailable. Please try again later.',
		503: 'Service unavailable. Please try again later.',
		504: 'Gateway timeout. Please try again.'
	};

	return statusMessages[status] || null;
}

/**
 * Extract error message from API response object
 */
function extractFromApiResponse(response: ApiErrorResponse): string | null {
	// Handle `detail` field (most common in FastAPI/Django)
	if (response.detail) {
		// detail can be a string
		if (typeof response.detail === 'string') {
			return response.detail;
		}

		// detail can be an array of validation errors
		if (Array.isArray(response.detail) && response.detail.length > 0) {
			// Join all error messages
			const messages = response.detail.map((err) => err.msg).filter(Boolean);
			if (messages.length > 0) {
				return messages.join(', ');
			}
		}
	}

	// Handle `message` field
	if (response.message && typeof response.message === 'string') {
		return response.message;
	}

	// Handle `error` field
	if (response.error && typeof response.error === 'string') {
		return response.error;
	}

	// Handle `errors` field (form validation errors)
	if (response.errors && typeof response.errors === 'object') {
		const errorMessages = Object.entries(response.errors)
			.map(([field, messages]) => {
				if (Array.isArray(messages) && messages.length > 0) {
					return `${field}: ${messages.join(', ')}`;
				}
				return null;
			})
			.filter(Boolean);

		if (errorMessages.length > 0) {
			return errorMessages.join('; ');
		}
	}

	return null;
}

/**
 * Extract error message from a fetch Response object
 *
 * This is async because we need to parse the response body
 *
 * @param response - The fetch Response object
 * @returns A user-friendly error message
 */
export async function extractErrorFromResponse(response: Response): Promise<string> {
	try {
		// Try to parse JSON response
		const data = await response.json();
		const message = extractFromApiResponse(data);
		if (message) return message;
	} catch {
		// If JSON parsing fails, try to get text
		try {
			const text = await response.text();
			if (text && text.length < 200) {
				return text;
			}
		} catch {
			// Ignore text parsing errors
		}
	}

	// Fallback to HTTP status messages
	return getStatusMessage(response.status) || `Request failed with status ${response.status}`;
}

/**
 * Check if an error is a network error (offline, timeout, etc.)
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		return (
			error.message.includes('Failed to fetch') ||
			error.message.includes('NetworkError') ||
			error.message.includes('timeout')
		);
	}
	return false;
}

/**
 * Check if an error is an authentication error (401, 403)
 */
export function isAuthError(error: unknown): boolean {
	if (error instanceof Error) {
		const apiError = error as Error & { response?: Response };
		if (apiError.response) {
			return apiError.response.status === 401 || apiError.response.status === 403;
		}
	}

	if (typeof error === 'object' && error !== null) {
		const errorObj = error as { status?: number };
		return errorObj.status === 401 || errorObj.status === 403;
	}

	return false;
}

/**
 * Create an error handler for TanStack Query mutations
 *
 * @param customMessage - Optional custom error message
 * @param onErrorCallback - Optional callback for additional error handling
 */
export function createMutationErrorHandler(
	customMessage?: string,
	onErrorCallback?: (error: unknown) => void
) {
	return (error: unknown) => {
		// Call custom callback first
		onErrorCallback?.(error);

		// Extract and return error message
		const message = customMessage || extractErrorMessage(error);
		return message;
	};
}
