import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import {
	mapGuestCheckoutError,
	GuestAccountRequiredError,
	GuestCartTooLargeError,
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

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
	info: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: toastMock }));

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

	// Backend #952: the two special guest 400s carry a machine-readable `code`
	// (issue #912). The guard runs BEFORE the next_step narrowing.
	it('maps a 400 guest_account_exists to GuestAccountRequiredError carrying the entered email', () => {
		const refusal = {
			detail: 'An account with this email already exists. Please log in.',
			code: 'guest_account_exists'
		};
		const error = mapGuestCheckoutError(refusal, 400, 'guest@example.com');
		expect(error).toBeInstanceOf(GuestAccountRequiredError);
		expect(error.message).toBe('An account with this email already exists. Please log in.');
		expect(error.cause).toBe(refusal);
		expect((error as GuestAccountRequiredError).email).toBe('guest@example.com');
	});

	it('maps a 400 guest_cart_too_large to GuestCartTooLargeError with frontend-localized copy', () => {
		const refusal = {
			detail: 'Backend copy that must NOT be rendered for this code.',
			code: 'guest_cart_too_large'
		};
		const error = mapGuestCheckoutError(refusal, 400, 'guest@example.com');
		expect(error).toBeInstanceOf(GuestCartTooLargeError);
		expect(error.message).toBe(
			'This order is too large to confirm by email as a guest. Log in to complete it in one purchase, or split it into smaller purchases.'
		);
		expect(error.cause).toBe(refusal);
		expect((error as GuestCartTooLargeError).email).toBe('guest@example.com');
	});

	it('degrades an unknown guest-action code to the verbatim detail (forward-compat)', () => {
		const refusal = { detail: 'A refusal this client does not know yet.', code: 'guest_new_rule' };
		const error = mapGuestCheckoutError(refusal, 400);
		expect(error).not.toBeInstanceOf(GuestAccountRequiredError);
		expect(error).not.toBeInstanceOf(GuestCartTooLargeError);
		expect(error.message).toBe('A refusal this client does not know yet.');
	});

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

	afterEach(() => {
		window.history.replaceState({}, '', '/');
	});

	it('stamps sanitised utm tags from the page URL onto the reserve payload', async () => {
		window.history.replaceState(
			{},
			'',
			'/events/acme/party?utm_source=instagram&utm_campaign=sept&utm_medium=b a d&other=1'
		);
		const controller = await renderController(makeDeps());
		await controller.checkoutCart(makeParams());

		await waitFor(() => {
			expect(eventpublicguestGuestMultiTierCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						attribution: { utm_source: 'instagram', utm_campaign: 'sept' }
					})
				})
			);
		});
	});

	it('sends attribution: null when the URL carries no tags', async () => {
		window.history.replaceState({}, '', '/events/acme/party');
		const controller = await renderController(makeDeps());
		await controller.checkoutCart(makeParams());

		await waitFor(() => {
			expect(eventpublicguestGuestMultiTierCheckout).toHaveBeenCalledWith(
				expect.objectContaining({ body: expect.objectContaining({ attribution: null }) })
			);
		});
	});
});

// Issue #912: errors the sheet renders with their own CTAs (log in / split the
// purchase) must not ALSO fire the generic checkout-failed toast — the inline
// alert is the feedback. Every other failure keeps the toast.
describe('createGuestCartCheckoutController — CTA-error toast suppression', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function checkoutWithError(errorBody: unknown): Promise<unknown> {
		eventpublicguestGuestMultiTierCheckout.mockResolvedValue({
			data: undefined,
			error: errorBody,
			response: { ok: false, status: 400 }
		});
		const controller = await renderController(makeDeps());
		return controller.checkoutCart(makeParams()).catch((e: unknown) => e);
	}

	it('does not toast a guest_account_exists refusal — the sheet renders the sign-in CTA', async () => {
		const thrown = await checkoutWithError({
			detail: 'An account with this email already exists.',
			code: 'guest_account_exists'
		});
		expect(thrown).toBeInstanceOf(GuestAccountRequiredError);
		expect((thrown as GuestAccountRequiredError).email).toBe('guest@example.com');
		expect(toastMock.error).not.toHaveBeenCalled();
	});

	it('does not toast a guest_cart_too_large refusal — the sheet renders the log-in/split CTAs', async () => {
		const thrown = await checkoutWithError({
			detail: 'Cart too large.',
			code: 'guest_cart_too_large'
		});
		expect(thrown).toBeInstanceOf(GuestCartTooLargeError);
		expect(toastMock.error).not.toHaveBeenCalled();
	});

	it('does not toast the next_step account-required refusal either', async () => {
		const thrown = await checkoutWithError({
			allowed: false,
			event_id: 'evt-1',
			next_step: 'become_member',
			reason: 'You must be a member to attend this event.'
		});
		expect(thrown).toBeInstanceOf(GuestAccountRequiredError);
		expect(toastMock.error).not.toHaveBeenCalled();
	});

	it('still toasts an ordinary checkout failure', async () => {
		const thrown = await checkoutWithError({ detail: 'Discount code is invalid.' });
		expect(thrown).toBeInstanceOf(Error);
		expect(toastMock.error).toHaveBeenCalledTimes(1);
	});
});
