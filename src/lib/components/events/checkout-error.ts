import * as m from '$lib/paraglide/messages.js';
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

/**
 * A checkout refused at 422 (#1001: country rules, e.g. online card payment for
 * an event held in Italy). The backend's `detail` is already translated and
 * names the country, so it wins; the generic "can't be bought online" copy is
 * only for a 422 that carries no readable detail.
 */
export function checkoutRefusedError(error: unknown): CheckoutRefusedError {
	return new CheckoutRefusedError(
		extractApiErrorDetail(error) ?? m['compliance.checkout.fallback'](),
		{ cause: error }
	);
}

/**
 * A sale the rules refuse outright. Its message is the whole story (no generic
 * "Checkout failed" title in front of it): callers toast `message` as the title
 * and the checkout sheet shows it inline as a `role="alert"`.
 */
export class CheckoutRefusedError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'CheckoutRefusedError';
	}
}
