import type { WalletPassErrorCode } from '$lib/api';

/**
 * The one wallet 503 body that means "try again", not "this deployment has no
 * wallet credentials".
 *
 * Referenced as `WalletPassErrorCode` rather than inlined at the comparison so
 * a backend rename of the enum member (BE calls that a breaking change) fails
 * type-check here instead of silently degrading every generation failure back
 * to the "not configured" copy.
 */
const PASS_UNAVAILABLE: WalletPassErrorCode = 'wallet_pass_unavailable';

/**
 * Both wallet rails answer 503 for two different situations: the deployment
 * has no wallet credentials at all (plain `{ detail }`, no `code`), and the
 * credentials are there but the pass could not be signed or built
 * (`WalletPassErrorSchema`, `code: "wallet_pass_unavailable"`). Only the second
 * is transient, so only the second gets the "try again later" copy.
 *
 * Takes `unknown` on purpose: hey-api's error IS the parsed body, typed as a
 * union across the three call arms, and the `detail` text is localized by the
 * backend and must never be matched on — `code` is the only stable signal.
 */
export function isWalletPassUnavailable(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === PASS_UNAVAILABLE
	);
}
