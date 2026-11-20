import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';

/** Body of the 429 the backend sends once an account's 2FA failure lock engages. */
const totpLockedBodySchema = z.object({ code: z.literal('totp_locked') });

/** Longest lock the backend applies is 15 minutes; anything above is not a plausible header. */
const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Whole minutes (rounded up, minimum 1) for a `Retry-After` header given in
 * seconds. Returns `null` when the header is missing or not a positive integer
 * (HTTP-date values are not sent by this backend).
 */
export function retryAfterToMinutes(header: string | null | undefined): number | null {
	if (header === null || header === undefined) return null;
	const trimmed = header.trim();
	if (!/^\d+$/.test(trimmed)) return null;
	const seconds = Number(trimmed);
	if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_RETRY_AFTER_SECONDS) return null;
	return Math.max(1, Math.ceil(seconds / 60));
}

export type OtpFailureKind = 'locked' | 'throttled' | null;

/**
 * Classify a failed OTP call. A 429 carrying `code: "totp_locked"` is the
 * per-account failure lock; any other 429 is the ordinary rate limit.
 * Branches on the status and `code`, never on the translated `detail`.
 */
export function classifyOtpFailure(
	response: Pick<Response, 'status'> | undefined,
	error: unknown
): OtpFailureKind {
	if (response?.status !== 429) return null;
	return totpLockedBodySchema.safeParse(error).success ? 'locked' : 'throttled';
}

/** The translated "verification is paused" sentence, with minutes when known. */
export function totpLockedMessage(response: Pick<Response, 'headers'> | undefined): string {
	const minutes = retryAfterToMinutes(response?.headers?.get('Retry-After'));
	return minutes === null ? m['totpLock.pausedNoTime']() : m['totpLock.paused']({ minutes });
}
