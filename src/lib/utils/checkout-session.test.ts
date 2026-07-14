import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	eventpublicticketsCheckoutSession,
	eventpublicguestGuestCheckoutSession,
	seriespassSeriesPassCheckoutSession
} from '$lib/api/generated/sdk.gen';
import {
	createCheckoutSession,
	resolveCheckoutUrl,
	CheckoutSessionError
} from './checkout-session';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicticketsCheckoutSession: vi.fn(),
	eventpublicguestGuestCheckoutSession: vi.fn(),
	seriespassSeriesPassCheckoutSession: vi.fn()
}));

type SessionOp = typeof eventpublicticketsCheckoutSession;

function mockResult(op: SessionOp, result: unknown) {
	vi.mocked(op).mockResolvedValue(result as Awaited<ReturnType<SessionOp>>);
}

const RESERVATION_ID = '3f9c2a34-9f14-4a7e-bc6e-0d5a8f6f0e11';

describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns the checkout URL and hits the authed endpoint for kind=user', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: { checkout_url: 'https://stripe.test/s/abc' },
			error: undefined,
			response: { status: 200 }
		});
		const url = await createCheckoutSession('user', RESERVATION_ID);
		expect(url).toBe('https://stripe.test/s/abc');
		expect(eventpublicticketsCheckoutSession).toHaveBeenCalledWith({
			path: { reservation_id: RESERVATION_ID }
		});
		expect(eventpublicguestGuestCheckoutSession).not.toHaveBeenCalled();
		expect(seriespassSeriesPassCheckoutSession).not.toHaveBeenCalled();
	});

	it('routes kind=guest to the public endpoint', async () => {
		mockResult(eventpublicguestGuestCheckoutSession, {
			data: { checkout_url: 'https://stripe.test/s/guest' },
			error: undefined,
			response: { status: 200 }
		});
		await expect(createCheckoutSession('guest', RESERVATION_ID)).resolves.toBe(
			'https://stripe.test/s/guest'
		);
		expect(eventpublicguestGuestCheckoutSession).toHaveBeenCalledWith({
			path: { reservation_id: RESERVATION_ID }
		});
	});

	it('routes kind=series-pass to the series-pass endpoint', async () => {
		mockResult(seriespassSeriesPassCheckoutSession, {
			data: { checkout_url: 'https://stripe.test/s/pass' },
			error: undefined,
			response: { status: 200 }
		});
		await expect(createCheckoutSession('series-pass', RESERVATION_ID)).resolves.toBe(
			'https://stripe.test/s/pass'
		);
		expect(seriespassSeriesPassCheckoutSession).toHaveBeenCalledWith({
			path: { reservation_id: RESERVATION_ID }
		});
	});

	it('throws a retryable CheckoutSessionError on a server error', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: undefined,
			error: { detail: 'Stripe is down' },
			response: { status: 500 }
		});
		const error = await createCheckoutSession('user', RESERVATION_ID).catch((e) => e);
		expect(error).toBeInstanceOf(CheckoutSessionError);
		expect(error.reservationId).toBe(RESERVATION_ID);
		expect(error.expired).toBe(false);
		expect(error.message).toBe('Stripe is down');
	});

	it('marks a 404 as expired (reservation unknown or reclaimed)', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: undefined,
			error: { detail: 'No pending reservation found.' },
			response: { status: 404 }
		});
		const error = await createCheckoutSession('user', RESERVATION_ID).catch((e) => e);
		expect(error).toBeInstanceOf(CheckoutSessionError);
		expect(error.expired).toBe(true);
	});

	it('throws a retryable CheckoutSessionError when the request itself rejects', async () => {
		vi.mocked(eventpublicticketsCheckoutSession).mockRejectedValue(
			new TypeError('Failed to fetch')
		);
		const error = await createCheckoutSession('user', RESERVATION_ID).catch((e) => e);
		expect(error).toBeInstanceOf(CheckoutSessionError);
		expect(error.reservationId).toBe(RESERVATION_ID);
		expect(error.expired).toBe(false);
	});

	it('treats a 200 without a checkout_url as a failure', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: {},
			error: undefined,
			response: { status: 200 }
		});
		await expect(createCheckoutSession('user', RESERVATION_ID)).rejects.toBeInstanceOf(
			CheckoutSessionError
		);
	});
});

describe('resolveCheckoutUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('passes through a checkout_url already present on the reserve response', async () => {
		const url = await resolveCheckoutUrl(
			{ checkout_url: 'https://stripe.test/s/legacy', reservation_id: null },
			'user'
		);
		expect(url).toBe('https://stripe.test/s/legacy');
		expect(eventpublicticketsCheckoutSession).not.toHaveBeenCalled();
	});

	it('chains the session call when requires_payment is set', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: { checkout_url: 'https://stripe.test/s/chained' },
			error: undefined,
			response: { status: 200 }
		});
		const url = await resolveCheckoutUrl(
			{ checkout_url: null, reservation_id: RESERVATION_ID, requires_payment: true },
			'user'
		);
		expect(url).toBe('https://stripe.test/s/chained');
	});

	it('returns null for completed free/offline results', async () => {
		const url = await resolveCheckoutUrl(
			{ checkout_url: null, reservation_id: null, requires_payment: false },
			'user'
		);
		expect(url).toBeNull();
		expect(eventpublicticketsCheckoutSession).not.toHaveBeenCalled();
	});

	it('propagates CheckoutSessionError from the chained call', async () => {
		mockResult(eventpublicticketsCheckoutSession, {
			data: undefined,
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		await expect(
			resolveCheckoutUrl(
				{ checkout_url: null, reservation_id: RESERVATION_ID, requires_payment: true },
				'user'
			)
		).rejects.toBeInstanceOf(CheckoutSessionError);
	});
});
