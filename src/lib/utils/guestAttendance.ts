import * as m from '$lib/paraglide/messages.js';

/**
 * Maps backend error messages to localized user-friendly messages
 * @param errorMessage - The error message from the backend API
 * @returns Localized error message
 */
export function getLocalizedError(errorMessage: string | undefined): string {
	if (!errorMessage) {
		return m['guest_attendance.network_error']();
	}

	const lowerMessage = errorMessage.toLowerCase();

	// Pattern: Account exists, must log in
	if (
		lowerMessage.includes('already exists') ||
		lowerMessage.includes('log in') ||
		lowerMessage.includes('login')
	) {
		return m['guest_attendance.account_exists']();
	}

	// Pattern: Event requires authentication
	if (lowerMessage.includes('requires login') || lowerMessage.includes('create an account')) {
		return m['guest_attendance.auth_required']();
	}

	// Pattern: Event is full
	if (lowerMessage.includes('full') || lowerMessage.includes('sold out')) {
		return m['guest_attendance.event_full']();
	}

	// Pattern: Deadline passed
	if (
		lowerMessage.includes('deadline') ||
		(lowerMessage.includes('expired') && lowerMessage.includes('rsvp'))
	) {
		return m['guest_attendance.deadline_passed']();
	}

	// Pattern: Token expired
	if (lowerMessage.includes('expired') && lowerMessage.includes('token')) {
		return m['guest_attendance.token_expired']();
	}

	// Pattern: Token already used
	if (
		lowerMessage.includes('already') &&
		(lowerMessage.includes('confirmed') || lowerMessage.includes('used'))
	) {
		return m['guest_attendance.token_used']();
	}

	// Pattern: Invalid token
	if (lowerMessage.includes('invalid') && lowerMessage.includes('token')) {
		return m['guest_attendance.token_invalid']();
	}

	// Pattern: Tickets unavailable
	if (
		lowerMessage.includes('ticket') &&
		(lowerMessage.includes('unavailable') || lowerMessage.includes('not available'))
	) {
		return m['guest_attendance.ticket_unavailable']();
	}

	// Fallback: Return backend message (backend uses Django i18n)
	return errorMessage;
}

/**
 * Extracts error message from various error formats
 * @param error - Error object from API call
 * @returns Error message string
 */
export function extractErrorMessage(error: unknown): string {
	// Handle different error formats
	if (typeof error === 'string') {
		return error;
	}

	if (error && typeof error === 'object') {
		// Handle @hey-api/client error format
		if ('body' in error && error.body && typeof error.body === 'object') {
			const body = error.body as Record<string, unknown>;
			if ('detail' in body && typeof body.detail === 'string') {
				return body.detail;
			}
			if ('message' in body && typeof body.message === 'string') {
				return body.message;
			}
		}

		// Handle Error instance
		if ('message' in error && typeof error.message === 'string') {
			return error.message;
		}
	}

	return m['guest_attendance.network_error']();
}

/**
 * Processes an API error and returns a localized user-friendly message
 * @param error - Error object from API call
 * @returns Localized error message
 */
export function handleGuestAttendanceError(error: unknown): string {
	const errorMessage = extractErrorMessage(error);
	return getLocalizedError(errorMessage);
}
