import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HeldPassCard from './HeldPassCard.svelte';
import type { HeldSeriesPassSchema } from '$lib/api/generated/types.gen';
import { formatPrice } from '$lib/utils/format';

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
	it('shows pass name, series name, and coverage', () => {
		render(HeldPassCard, { props: { heldPass: makeHeldPass() } });
		expect(screen.getByText('Full course')).toBeInTheDocument();
		expect(screen.getByText('Yoga Wednesdays')).toBeInTheDocument();
		expect(screen.getByText(/4 of 6 events remaining/i)).toBeInTheDocument();
	});

	it('reflects series progress in the progressbar', () => {
		render(HeldPassCard, { props: { heldPass: makeHeldPass() } });
		// 2 of 6 events consumed -> 33%
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
	});

	it('shows the view button for active passes', () => {
		render(HeldPassCard, { props: { heldPass: makeHeldPass({ status: 'active' }) } });
		expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
	});

	it('hides the view button for cancelled passes', () => {
		render(HeldPassCard, { props: { heldPass: makeHeldPass({ status: 'cancelled' }) } });
		expect(screen.queryByRole('button', { name: /view pass/i })).toBeNull();
	});

	it('shows the price paid', () => {
		render(HeldPassCard, { props: { heldPass: makeHeldPass() } });
		// Price rendering is locale-dependent and may use no-break spaces the DOM
		// normalizer collapses — compare whitespace-stripped strings.
		const expected = formatPrice('30.00', 'EUR').replace(/\s/g, '');
		expect(
			screen.getByText((text) => text.replace(/\s/g, '').includes(expected))
		).toBeInTheDocument();
	});
});
