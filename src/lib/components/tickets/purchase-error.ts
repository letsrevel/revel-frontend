import * as m from '$lib/paraglide/messages.js';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
import type { BestAvailableHoldResult, HoldConflictReason } from './seat-hold-controller.svelte';

/**
 * Localized copy for a hold 409, keyed on the backend's conflict_reason:
 * 'capacity' = per-identity hold cap exceeded (not a seating problem),
 * anything else = the seat was taken/blocked.
 */
export function holdConflictMessage(reason: HoldConflictReason): string {
	if (reason === 'capacity') {
		return m['seatSelector.holdLimitReached']();
	}
	return m['seatSelector.seatConflict']();
}

/**
 * Localized copy for a failed best-available hold, keyed on the unified 409
 * body's conflict_reason: 'no_block' = no adjacent block fits (smaller
 * quantity may), 'capacity' = the hold cap (must not be blamed on adjacency),
 * 'unavailable' = seats vanished mid-assignment (retrying may work). Absent
 * reason (network failure) falls back to any backend detail, then the generic
 * adjacency copy.
 */
export function bestAvailableFailureMessage(result: BestAvailableHoldResult): string {
	if (result.reason === 'capacity') return holdConflictMessage('capacity');
	if (result.reason === 'unavailable') {
		return m['ticketConfirmationDialog.bestAvailableRetry']();
	}
	if (result.reason === undefined && result.message) return result.message;
	return m['ticketConfirmationDialog.bestAvailableConflict']();
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
	const detail = extractApiErrorDetail(resp?.data) ?? extractApiErrorDetail(obj);
	if (detail) return detail;
	if (typeof obj.message === 'string') return obj.message;
	return fallback;
}
