import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TierCard from './TierCard.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';

function makeTier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: 'tier-1',
		event_id: 'event-1',
		name: 'General Admission',
		description: null,
		price: '0',
		currency: 'EUR',
		payment_method: 'free',
		price_type: 'fixed',
		total_available: null,
		can_purchase: true,
		...overrides
	} as TierSchemaWithId;
}

function renderCard(tier: TierSchemaWithId, capacityDisclosed?: boolean) {
	render(TierCard, {
		props: { tier, isAuthenticated: true, capacityDisclosed, onSelectTier: vi.fn() }
	});
}

// #690 / backend #825: `total_available === null` means "unlimited" when the
// event discloses capacity and "withheld" when it does not. Only the event-level
// `show_capacity` distinguishes them.
describe('TierCard — inventory disclosure', () => {
	it('says "Unlimited" for a null quantity when capacity is disclosed', () => {
		renderCard(makeTier({ total_available: null }), true);
		expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
	});

	it('defaults to disclosed when the caller cannot say', () => {
		renderCard(makeTier({ total_available: null }));
		expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
	});

	it('says nothing about inventory for a null quantity when capacity is withheld', () => {
		renderCard(makeTier({ total_available: null }), false);
		expect(screen.queryByText(/unlimited/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
	});

	it('still reports a concrete remaining count regardless of the flag', () => {
		renderCard(makeTier({ total_available: 7 }), false);
		expect(screen.getByText(/7 remaining/i)).toBeInTheDocument();
	});

	it('still reports sold out regardless of the flag', () => {
		// Two nodes: the inventory row and the disabled CTA.
		renderCard(makeTier({ total_available: 0 }), false);
		expect(screen.getAllByText(/sold out/i).length).toBeGreaterThan(0);
	});
});
