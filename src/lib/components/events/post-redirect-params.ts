/**
 * Post-redirect URL params on the event page (#853 Task 9 extraction).
 *
 * Stripe checkout, the RSVP flow, and the guest ticket flow all bounce the
 * buyer back to the event page with query params encoding what just
 * happened (`payment_success`, `payment_cancelled`, `rsvp`, `ticket_id`,
 * `discount`). This reads them once, strips every param it recognizes via a
 * SINGLE `history.replaceState` (any params it doesn't recognize survive),
 * and returns plain values for the caller to assign into `$state`.
 *
 * Pure aside from the `window` reads/writes — no query invalidation, no
 * modal side effects. Those stay in the page's `onMount`, which is also the
 * only place this should be called from (it reads `window.location.search`
 * at call time, so calling it more than once, or outside the browser, is
 * not meaningful).
 */

export interface PostRedirectParams {
	paymentSuccess: boolean;
	paymentCancelled: boolean;
	rsvpConfirmed: string | null;
	ticketConfirmed: boolean;
	discountCode: string;
}

const RSVP_STATUSES = ['yes', 'no', 'maybe'];

export function consumePostRedirectParams(): PostRedirectParams {
	const params = new URLSearchParams(window.location.search);

	const paymentSuccess = params.get('payment_success') === 'true';
	const paymentCancelled = params.get('payment_cancelled') === 'true';

	const rsvpParam = params.get('rsvp');
	const rsvpConfirmed = rsvpParam && RSVP_STATUSES.includes(rsvpParam) ? rsvpParam : null;

	const ticketConfirmed = Boolean(params.get('ticket_id'));

	const discountParam = params.get('discount');
	const discountCode = discountParam ? discountParam.toUpperCase() : '';

	let mutated = false;
	if (paymentSuccess) {
		params.delete('payment_success');
		mutated = true;
	}
	if (paymentCancelled) {
		params.delete('payment_cancelled');
		mutated = true;
	}
	if (rsvpConfirmed !== null) {
		params.delete('rsvp');
		mutated = true;
	}
	if (ticketConfirmed) {
		params.delete('ticket_id');
		mutated = true;
	}
	if (discountParam) {
		params.delete('discount');
		mutated = true;
	}

	if (mutated) {
		const query = params.toString();
		const cleanUrl = window.location.pathname + (query ? `?${query}` : '');
		window.history.replaceState({}, '', cleanUrl);
	}

	return { paymentSuccess, paymentCancelled, rsvpConfirmed, ticketConfirmed, discountCode };
}
