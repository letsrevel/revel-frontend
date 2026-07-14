import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SeriesPassCard from './SeriesPassCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { seriespassGetSeriesPassQuote } from '$lib/api/generated/sdk.gen';
import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';
import { formatPrice } from '$lib/utils/format';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	seriespassGetSeriesPassQuote: vi.fn(),
	seriespassCheckoutSeriesPass: vi.fn(),
	// Imported by the checkout-session helper the purchase dialog uses (#464).
	seriespassSeriesPassCheckoutSession: vi.fn(),
	eventpublicticketsCheckoutSession: vi.fn(),
	eventpublicguestGuestCheckoutSession: vi.fn()
}));

function makePass(overrides: Partial<SeriesPassSchema> = {}): SeriesPassSchema {
	return {
		id: 'pass-1',
		name: 'Full course',
		description: null,
		price: '36.00',
		pro_rata_discount: '6.00',
		currency: 'EUR',
		payment_method: 'online',
		purchasable_by: 'public',
		sales_start_at: null,
		sales_end_at: null,
		...overrides
	};
}

function mockQuote(quote: Partial<SeriesPassQuoteSchema> = {}) {
	vi.mocked(seriespassGetSeriesPassQuote).mockResolvedValue({
		data: {
			price: '36.00',
			passed_events: 0,
			remaining_events: 6,
			currency: 'EUR',
			purchasable: true,
			reason: null,
			...quote
		},
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as ReturnType<typeof seriespassGetSeriesPassQuote>);
}

describe('SeriesPassCard', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	function renderCard(pass: SeriesPassSchema, isAuthenticated = true) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: SeriesPassCard,
				props: { pass, seriesId: 'series-1', isAuthenticated }
			}
		});
	}

	it('shows the coverage line from the live quote', async () => {
		mockQuote({ passed_events: 1, remaining_events: 5, price: '30.00' });
		renderCard(makePass());
		await waitFor(() => {
			expect(screen.getByText(/5 of 6 events remaining/i)).toBeInTheDocument();
		});
	});

	it('strikes through the season price when the pro-rata discount applies', async () => {
		mockQuote({ passed_events: 2, remaining_events: 4, price: '24.00' });
		renderCard(makePass());
		// Price rendering is locale-dependent and may use no-break spaces the DOM
		// normalizer collapses — compare whitespace-stripped strings.
		const strip = (s: string) => s.replace(/\s/g, '');
		await waitFor(() => {
			const struck = document.querySelector('.line-through');
			expect(strip(struck?.textContent ?? '')).toContain(strip(formatPrice('36.00', 'EUR')));
		});
		expect(
			screen.getByText((text) => strip(text).includes(strip(formatPrice('24.00', 'EUR'))))
		).toBeInTheDocument();
	});

	it('does not strike through when no events have passed', async () => {
		mockQuote({ passed_events: 0, remaining_events: 6, price: '36.00' });
		renderCard(makePass());
		await waitFor(() => {
			expect(screen.getByText(/6 of 6 events remaining/i)).toBeInTheDocument();
		});
		expect(document.querySelector('.line-through')).toBeNull();
	});

	it('disables the CTA and shows the backend reason when not purchasable', async () => {
		mockQuote({ purchasable: false, reason: 'This pass is sold out.' });
		renderCard(makePass());
		await waitFor(() => {
			expect(screen.getByText('This pass is sold out.')).toBeInTheDocument();
		});
		expect(screen.getByRole('button', { name: /not available/i })).toBeDisabled();
	});

	it('shows an enabled buy button when purchasable', async () => {
		mockQuote();
		renderCard(makePass());
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /get season pass/i })).toBeEnabled();
		});
	});

	it('shows the offline payment hint for offline passes', async () => {
		mockQuote();
		renderCard(makePass({ payment_method: 'offline' }));
		await waitFor(() => {
			expect(screen.getByText(/pay at the venue/i)).toBeInTheDocument();
		});
	});
});
