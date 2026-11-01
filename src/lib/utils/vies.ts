import { z } from 'zod';
import type { ViesUnavailableCode } from '$lib/api/generated/types.gen';

export type ViesOutcome = 'pending' | 'unvalidated' | 'not_saved';

// `satisfies` makes a new backend code a compile error until it is handled here.
const KNOWN_CODES = {
	vies_unavailable_saved_pending: true,
	vies_unavailable_saved_unvalidated: true,
	vies_unavailable_not_saved: true
} satisfies Record<ViesUnavailableCode, true>;

const CODE_VALUES = Object.keys(KNOWN_CODES) as [ViesUnavailableCode, ...ViesUnavailableCode[]];
const codeBody = z.object({ code: z.enum(CODE_VALUES) });
const detailBody = z.object({ detail: z.string() });

/** The machine-readable code of a 503 VIES-unavailable body, or null if absent/unknown. */
export function viesUnavailableCode(error: unknown): ViesUnavailableCode | null {
	const parsed = codeBody.safeParse(error);
	return parsed.success ? parsed.data.code : null;
}

/** The server-provided `detail` text of the error body, or '' (display only, never branched on). */
export function viesUnavailableDetail(error: unknown): string {
	const parsed = detailBody.safeParse(error);
	return parsed.success ? parsed.data.detail : '';
}

/**
 * Outcome for a VIES-unavailable response. `fallback` covers a 503 without a known
 * code (older backend): the org page treats it as 'pending', the account form as 'unvalidated'.
 */
export function viesOutcome(
	code: ViesUnavailableCode | null,
	fallback: Exclude<ViesOutcome, 'not_saved'>
): ViesOutcome {
	switch (code) {
		case 'vies_unavailable_saved_pending':
			return 'pending';
		case 'vies_unavailable_saved_unvalidated':
			return 'unvalidated';
		case 'vies_unavailable_not_saved':
			return 'not_saved';
		default:
			return fallback;
	}
}
