import { z } from 'zod';

/**
 * Client-side reading of the unsubscribe-link token (#982).
 *
 * The token is an HS256 JWT. We only decode it — the backend verifies the
 * signature on submit — so the page can show the invalid-link state on load
 * instead of failing at submit, and pick the right flow for the token type.
 * Links issued before BE #1030 still carry a 30-day `exp`; newer ones live
 * about ten years.
 */

const unsubscribeClaims = z.object({
	type: z.literal('unsubscribe'),
	email: z.string(),
	exp: z.number(),
	notification_type: z.string().nullish(),
	organization_id: z.string().nullish()
});

/** Cold-mail opt-out for addresses without an account (invitations). */
const emailOptOutClaims = z.object({
	type: z.literal('email_opt_out'),
	email: z.string(),
	exp: z.number(),
	organization_id: z.string().nullish()
});

const tokenClaims = z.discriminatedUnion('type', [unsubscribeClaims, emailOptOutClaims]);

export type UnsubscribeTokenInfo =
	| { status: 'missing' }
	| { status: 'invalid' }
	| { status: 'expired' }
	| {
			status: 'valid';
			kind: 'unsubscribe';
			email: string;
			notificationType: string | null;
			organizationId: string | null;
	  }
	| { status: 'valid'; kind: 'email_opt_out'; email: string; organizationId: string | null };

function decodeBase64Url(segment: string): string {
	const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
	// fatal: a payload that isn't valid UTF-8 is a malformed token, not mojibake.
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Classify an unsubscribe token from the `?token=` query parameter.
 *
 * @param token - raw token, or null when the parameter is absent
 * @param nowMs - current time in ms (injectable for tests)
 */
export function readUnsubscribeToken(
	token: string | null,
	nowMs: number = Date.now()
): UnsubscribeTokenInfo {
	if (!token) return { status: 'missing' };

	const parts = token.split('.');
	if (parts.length !== 3) return { status: 'invalid' };

	let claims: z.infer<typeof tokenClaims>;
	try {
		const parsed = tokenClaims.safeParse(JSON.parse(decodeBase64Url(parts[1])));
		if (!parsed.success) return { status: 'invalid' };
		claims = parsed.data;
	} catch {
		return { status: 'invalid' };
	}

	if (claims.exp * 1000 <= nowMs) return { status: 'expired' };

	if (claims.type === 'email_opt_out') {
		return {
			status: 'valid',
			kind: 'email_opt_out',
			email: claims.email,
			organizationId: claims.organization_id ?? null
		};
	}
	return {
		status: 'valid',
		kind: 'unsubscribe',
		email: claims.email,
		notificationType: claims.notification_type ?? null,
		organizationId: claims.organization_id ?? null
	};
}
