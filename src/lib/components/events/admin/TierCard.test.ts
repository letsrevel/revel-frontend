import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TierCard from './TierCard.svelte';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';

function makeTier(totalQuantity: number | null): TicketTierDetailSchema {
	return {
		id: 'tier-1',
		event_id: 'evt-1',
		name: 'Early Bird',
		payment_method: 'offline',
		price_type: 'fixed',
		price: '10.00',
		currency: 'EUR',
		total_quantity: totalQuantity,
		quantity_sold: 0,
		seat_assignment_mode: 'none',
		visibility: 'public',
		purchasable_by: 'public'
	} as TicketTierDetailSchema;
}

function renderCard(
	totalQuantity: number | null,
	eventCapacity: number | null
): ReturnType<typeof render> {
	return render(TierCard, {
		props: { tier: makeTier(totalQuantity), onEdit: vi.fn(), eventCapacity }
	});
}

function overCapacityBadges(): HTMLElement[] {
	return screen
		.queryAllByTestId('status-badge')
		.filter((el) => el.textContent?.includes('Over event capacity'));
}

describe('TierCard event-capacity flag', () => {
	it('shows the badge and explanatory line when quantity exceeds capacity', () => {
		renderCard(40, 30);

		expect(overCapacityBadges()).toHaveLength(1);
		expect(screen.getByTestId('tier-over-capacity')).toHaveTextContent(
			'Event capped at 30: at most 30 can sell'
		);
	});

	it.each([
		['within capacity', 20, 30],
		['equal to capacity', 30, 30],
		['unlimited tier', null, 30],
		['uncapped event', 40, null]
	])('shows nothing when %s', (_label, quantity, capacity) => {
		renderCard(quantity, capacity);

		expect(overCapacityBadges()).toHaveLength(0);
		expect(screen.queryByTestId('tier-over-capacity')).not.toBeInTheDocument();
	});
});

// The admin listing clamps `total_available` by the event's remaining capacity
// and flags it with `capped_by_event` (backend #1209).
describe('TierCard quantity line under an event cap', () => {
	function renderListed(overrides: Partial<TicketTierDetailSchema>): ReturnType<typeof render> {
		return render(TierCard, {
			props: { tier: { ...makeTier(40), ...overrides }, onEdit: vi.fn() }
		});
	}

	it('labels a clamped figure as the event cap', () => {
		renderListed({ total_available: 30, capped_by_event: true });
		expect(screen.getByText('30 of 40 remaining (event cap)')).toBeInTheDocument();
	});

	it('shows the event-capped figure for an unlimited tier', () => {
		renderListed({ total_quantity: null, total_available: 27, capped_by_event: true });
		expect(screen.getByText('27 remaining (event cap)')).toBeInTheDocument();
	});

	it('keeps the plain figures when the event cap does not bind', () => {
		renderListed({ total_available: 12, capped_by_event: false });
		expect(screen.getByText('12 of 40 remaining')).toBeInTheDocument();
		expect(screen.queryByText(/event cap\)/)).not.toBeInTheDocument();
	});
});
