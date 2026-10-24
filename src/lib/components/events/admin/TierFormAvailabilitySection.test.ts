import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TierFormAvailabilitySection from './TierFormAvailabilitySection.svelte';

function renderSection(totalQuantity: string, eventCapacity: number | null) {
	return render(TierFormAvailabilitySection, {
		props: {
			totalQuantity,
			salesStartAt: '',
			salesEndAt: '',
			salesStartReadback: '',
			salesEndReadback: '',
			visibility: 'public' as const,
			purchasableBy: 'public' as const,
			restrictVisibilityToLinkedInvitations: false,
			restrictPurchaseToLinkedInvitations: false,
			restrictedToMembershipTiersIds: [],
			membershipTiers: [],
			salesPaused: false,
			eventCapacity,
			isPending: false
		}
	});
}

describe('TierFormAvailabilitySection event-capacity warning', () => {
	it('warns and wires aria-describedby when quantity exceeds the event capacity', () => {
		renderSection('40', 30);

		const warning = screen.getByTestId('tier-capacity-warning');
		expect(warning).toHaveTextContent('capped at 30 attendees');
		expect(warning).toHaveTextContent('quantity is 40');
		const input = document.getElementById('total-quantity') as HTMLInputElement;
		const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ');
		expect(describedBy).toContain('total-quantity-hint');
		expect(describedBy).toContain(warning.id);
		expect(document.getElementById('total-quantity-hint')).toBeInTheDocument();
	});

	it.each([
		['quantity below capacity', '20', 30],
		['quantity equal to capacity', '30', 30],
		['unlimited tier on a capped event', '', 30],
		['uncapped event', '40', null]
	])('shows no warning for %s', (_label, quantity, capacity) => {
		renderSection(quantity, capacity);

		expect(screen.queryByTestId('tier-capacity-warning')).not.toBeInTheDocument();
		const input = document.getElementById('total-quantity') as HTMLInputElement;
		expect(input.getAttribute('aria-describedby')).toBe('total-quantity-hint');
	});
});
