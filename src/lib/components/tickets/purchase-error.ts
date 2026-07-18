import * as m from '$lib/paraglide/messages.js';
import type { BestAvailableHoldResult, HoldConflictReason } from './seat-hold-controller.svelte';

/**
 * Localized copy for a hold 409, keyed on the backend's conflict_reason:
 * 'capacity' = per-identity hold cap exceeded (not a seating problem),
 * 'unavailable' = the seat was taken/blocked.
 */
export function holdConflictMessage(reason: HoldConflictReason): string {
	if (reason === 'capacity') {
		return (
			m['seatSelector.holdLimitReached']?.() ??
			"You've reached the seat hold limit for this event — try a smaller quantity."
		);
	}
	return m['seatSelector.seatConflict']?.() ?? 'That seat was just taken — please pick another.';
}

/**
 * Localized copy for a failed best-available hold. Prefers the backend's own
 * detail; a capacity 409 must not be blamed on adjacency.
 */
export function bestAvailableFailureMessage(result: BestAvailableHoldResult): string {
	if (result.message) return result.message;
	if (result.reason === 'capacity') return holdConflictMessage('capacity');
	return (
		m['ticketConfirmationDialog.bestAvailableConflict']?.() ??
		'Not enough adjacent seats available — try a smaller quantity.'
	);
}

/**
 * Extract a human-readable message from an unknown purchase/checkout error.
 *
 * Handles the shapes thrown along the ticket purchase path: SDK errors with a
 * `response.data.detail` (string or DRF-style list), plain `{ detail }` bodies,
 * and generic `Error` objects. Falls back to the provided localized message.
 */
export function extractPurchaseErrorMessage(err: unknown, fallback: string): string {
	if (!err || typeof err !== 'object') return fallback;
	const obj = err as Record<string, unknown>;
	const resp = obj.response as Record<string, unknown> | undefined;
	const data = resp?.data as Record<string, unknown> | undefined;
	if (typeof data?.detail === 'string') return data.detail;
	if (Array.isArray(data?.detail)) {
		return data.detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ');
	}
	if (typeof obj.detail === 'string') return obj.detail;
	if (typeof obj.message === 'string') return obj.message;
	return fallback;
}
