import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import HeldPassCard from './HeldPassCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { eventseriesGetEventSeries } from '$lib/api/generated/sdk.gen';
import type { HeldSeriesPassSchema } from '$lib/api/generated/types.gen';
import { formatPrice } from '$lib/utils/format';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventseriesGetEventSeries: vi.fn(),
	seriespassDownloadSeriesPassPdf: vi.fn(),
	seriespassDownloadSeriesPassPkpass: vi.fn()
}));

function mockSeriesDetail() {
	vi.mocked(eventseriesGetEventSeries).mockResolvedValue({
		data: {
			id: 'series-1',
			name: 'Yoga Wednesdays',
			slug: 'yoga-wednesdays',
			organization: { slug: 'acme' }
		},
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as ReturnType<typeof eventseriesGetEventSeries>);
}

function makeHeldPass(overrides: Partial<HeldSeriesPassSchema> = {}): HeldSeriesPassSchema {
	return {
		id: 'held-1',
		status: 'active',
		series_pass: {
			id: 'pass-1',
			name: 'Full course',
			description: null,
			price: '36.00',
			pro_rata_discount: '6.00',
			currency: 'EUR',
			payment_method: 'online',
			purchasable_by: 'public',
			sales_start_at: null,
			sales_end_at: null
		},
		series: { id: 'series-1', name: 'Yoga Wednesdays', slug: 'yoga-wednesdays' },
		remaining_event_count: 4,
		total_event_count: 6,
		price_paid: '30.00',
		created_at: '2026-07-01T10:00:00Z',
		...overrides
	};
}

describe('HeldPassCard', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSeriesDetail();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	function renderCard(heldPass: HeldSeriesPassSchema) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: HeldPassCard,
				props: { heldPass }
			}
		});
	}

	it('shows pass name, series name, and coverage', () => {
		renderCard(makeHeldPass());
		expect(screen.getByText('Full course')).toBeInTheDocument();
		expect(screen.getByText('Yoga Wednesdays')).toBeInTheDocument();
		expect(screen.getByText(/4 of 6 events remaining/i)).toBeInTheDocument();
	});

	it('links the series name once the org slug resolves', async () => {
		renderCard(makeHeldPass());
		await waitFor(() => {
			const link = screen.getByRole('link', { name: 'Yoga Wednesdays' });
			expect(link).toHaveAttribute(
				'href',
				expect.stringContaining('/events/acme/series/yoga-wednesdays')
			);
		});
	});

	it('keeps the series name as plain text when the lookup fails', async () => {
		vi.mocked(eventseriesGetEventSeries).mockResolvedValue({
			data: undefined,
			error: { detail: 'Not found' },
			response: { ok: false } as unknown as Response
		} as unknown as ReturnType<typeof eventseriesGetEventSeries>);
		renderCard(makeHeldPass());
		expect(screen.getByText('Yoga Wednesdays')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Yoga Wednesdays' })).toBeNull();
	});

	it('reflects series progress in the progressbar', () => {
		renderCard(makeHeldPass());
		// 2 of 6 events consumed -> 33%
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
	});

	it('shows the view button for active passes', () => {
		renderCard(makeHeldPass({ status: 'active' }));
		expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
	});

	it('hides the view button for cancelled passes', () => {
		renderCard(makeHeldPass({ status: 'cancelled' }));
		expect(screen.queryByRole('button', { name: /view pass/i })).toBeNull();
	});

	it('shows the price paid', () => {
		renderCard(makeHeldPass());
		// Price rendering is locale-dependent and may use no-break spaces the DOM
		// normalizer collapses — compare whitespace-stripped strings.
		const expected = formatPrice('30.00', 'EUR').replace(/\s/g, '');
		expect(
			screen.getByText((text) => text.replace(/\s/g, '').includes(expected))
		).toBeInTheDocument();
	});
});
