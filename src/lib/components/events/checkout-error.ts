import { getEligibilityRefusalMessage } from '$lib/utils/eligibility';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

/**
 * Turn a backend error envelope into a throwable Error.
 *
 * The checkout endpoints declare `EventUserEligibility | ErrorDetail` at 400
 * (backend #824), so the union must be probed before it is read. A refused
 * purchase (BE #807) answers with the whole eligibility payload and has no
 * `detail` at all; capacity, seat-resolution, discount-code, PWYC-bound and
 * Stripe-config rejections answer with `{detail}`. The refusal is read first and
 * kept as `cause`, so the confirmation dialog can recognise it and offer its own
 * CTA. `extractApiErrorDetail` also covers the request-validation 422, whose
 * `detail` is a list of objects rather than a string.
 */
export function checkoutError(error: unknown, fallback: string): Error {
	const refusal = getEligibilityRefusalMessage(error);
	if (refusal) return new Error(refusal, { cause: error });
	return new Error(extractApiErrorDetail(error) ?? fallback, { cause: error });
}
