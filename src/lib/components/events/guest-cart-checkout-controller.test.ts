import { describe, it, expect } from 'vitest';
import {
	mapGuestCheckoutError,
	GuestAccountRequiredError,
	GUEST_COMPATIBLE_STEPS
} from './guest-cart-checkout-controller.svelte';

describe('mapGuestCheckoutError', () => {
	it('maps 404 to the stale-cart message, keeping the original error as cause', () => {
		const original = { detail: 'Tier not found' };
		const error = mapGuestCheckoutError(original, 404);
		expect(error.message).toBe(
			'Your cart is out of date — some tickets are no longer available. Please refresh the page and try again.'
		);
		expect(error.cause).toBe(original);
	});

	it('maps 403 to the backend detail when present', () => {
		const original = { detail: 'You are not allowed to purchase from this tier.' };
		const error = mapGuestCheckoutError(original, 403);
		expect(error.message).toBe('You are not allowed to purchase from this tier.');
		expect(error.cause).toBe(original);
	});

	it('maps 403 without a detail to the sale-window-closed fallback', () => {
		const error = mapGuestCheckoutError({}, 403);
		expect(error.message).toBe(
			'The sale window for a ticket in your cart just closed. Please refresh the page.'
		);
	});

	it('maps a 400 eligibility refusal with a guest-incompatible next_step to GuestAccountRequiredError', () => {
		const refusal = {
			allowed: false,
			event_id: 'evt-1',
			next_step: 'become_member',
			reason: 'You must be a member to attend this event.'
		};
		const error = mapGuestCheckoutError(refusal, 400);
		expect(error).toBeInstanceOf(GuestAccountRequiredError);
		expect(error.message).toBe('You must be a member to attend this event.');
		expect(error.cause).toBe(refusal);
	});

	it.each(Array.from(GUEST_COMPATIBLE_STEPS))(
		'does NOT raise GuestAccountRequiredError for the guest-compatible next_step %s',
		(nextStep) => {
			const refusal = { allowed: false, event_id: 'evt-1', next_step: nextStep };
			const error = mapGuestCheckoutError(refusal, 400);
			expect(error).not.toBeInstanceOf(GuestAccountRequiredError);
		}
	);

	it('falls back to checkoutError for a 400 without an eligibility-shaped body', () => {
		const original = { detail: 'Discount code is invalid.' };
		const error = mapGuestCheckoutError(original, 400);
		expect(error).not.toBeInstanceOf(GuestAccountRequiredError);
		expect(error.message).toBe('Discount code is invalid.');
	});

	it('falls back to checkoutError for an unmapped status (e.g. 422 or undefined)', () => {
		const original = { detail: 'Something else went wrong.' };
		expect(mapGuestCheckoutError(original, 422).message).toBe('Something else went wrong.');
		expect(mapGuestCheckoutError(original, undefined).message).toBe('Something else went wrong.');
	});

	it('falls back to the generic checkout-failed copy when nothing readable is present', () => {
		const error = mapGuestCheckoutError({}, undefined);
		expect(error.message).toBe('Checkout failed');
	});
});
