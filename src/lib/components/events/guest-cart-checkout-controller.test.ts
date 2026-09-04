import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import {
	mapGuestCheckoutError,
	GuestAccountRequiredError,
	GUEST_COMPATIBLE_STEPS,
	type GuestCartCheckoutDeps,
	createGuestCartCheckoutController
} from './guest-cart-checkout-controller.svelte';
import GuestCartCheckoutControllerTestHost from './GuestCartCheckoutControllerTestHost.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { GuestCartCheckoutParams } from '../tickets/cart-payload';

const eventpublicguestGuestMultiTierCheckout = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicguestGuestMultiTierCheckout
}));

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

// Backend #923: the guest multi-tier checkout claims an invitation-link token
// sent via X-Event-Token before eligibility and tier-access checks run.
describe('createGuestCartCheckoutController — invitation-link token header', () => {
	function makeDeps(overrides: Partial<GuestCartCheckoutDeps> = {}): GuestCartCheckoutDeps {
		return {
			eventId: 'event-1',
			queryClient: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			onPurchaseComplete: vi.fn(),
			onEmailConfirmationPending: vi.fn(),
			...overrides
		};
	}

	function makeParams(): GuestCartCheckoutParams {
		return {
			items: [],
			email: 'guest@example.com',
			first_name: 'Guest',
			last_name: 'Example'
		};
	}

	function renderController(
		deps: GuestCartCheckoutDeps
	): Promise<ReturnType<typeof createGuestCartCheckoutController>> {
		return new Promise((resolve) => {
			render(QueryClientTestWrapper, {
				props: {
					client: deps.queryClient,
					component: GuestCartCheckoutControllerTestHost,
					componentProps: { deps, onReady: resolve }
				}
			});
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		eventpublicguestGuestMultiTierCheckout.mockResolvedValue({
			data: { message: 'Check your email' },
			error: undefined,
			response: { ok: true, status: 200 }
		});
	});

	it('sends X-Event-Token when an event token is present', async () => {
		const controller = await renderController(makeDeps({ eventToken: 'tok-123' }));
		await controller.checkoutCart(makeParams());

		await waitFor(() => {
			expect(eventpublicguestGuestMultiTierCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { 'X-Event-Token': 'tok-123' }
				})
			);
		});
	});

	it('sends no X-Event-Token header without a token', async () => {
		const controller = await renderController(makeDeps());
		await controller.checkoutCart(makeParams());

		await waitFor(() => {
			expect(eventpublicguestGuestMultiTierCheckout).toHaveBeenCalled();
		});
		const options = eventpublicguestGuestMultiTierCheckout.mock.calls[0][0];
		expect(options.headers ?? {}).not.toHaveProperty('X-Event-Token');
	});
});
