import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TicketTierList from './TicketTierList.svelte';
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

function renderList(props: Record<string, unknown> = {}) {
	return render(TicketTierList, {
		props: { tiers: [makeTier()], isAuthenticated: true, onSelectTier: vi.fn(), ...props }
	});
}

// The list renders in two places since the tiers dialog (#853 follow-up): the
// page body and the dialog. `headingId` keeps the heading anchor unique per
// mount — without it both would emit id="ticket-tiers".
describe('TicketTierList — heading anchor', () => {
	it('defaults its heading anchor to ticket-tiers', () => {
		const { container } = renderList();
		expect(container.querySelector('#ticket-tiers')).toBeInTheDocument();
		expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
			'ticket-tiers'
		);
	});

	it('headingId overrides both the heading id and the section label wiring', () => {
		const { container } = renderList({ headingId: 'ticket-tiers-dialog' });
		expect(container.querySelector('#ticket-tiers-dialog')).toBeInTheDocument();
		expect(container.querySelector('#ticket-tiers')).not.toBeInTheDocument();
		expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
			'ticket-tiers-dialog'
		);
	});
});
