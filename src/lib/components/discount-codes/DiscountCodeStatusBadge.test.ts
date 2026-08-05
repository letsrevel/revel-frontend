import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import DiscountCodeStatusBadge from './DiscountCodeStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/SubscriptionStatusBadge.test.ts`: this pill's
 * accessible NAME is what locates a code's active/inactive state in the
 * discount-codes admin table and its mobile card twin.
 */
describe('discount-codes/DiscountCodeStatusBadge', () => {
	it('renders "Active" on the pill when active', () => {
		render(DiscountCodeStatusBadge, { props: { isActive: true } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Active');
	});

	it('renders "Inactive" on the pill when inactive', () => {
		render(DiscountCodeStatusBadge, { props: { isActive: false } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Inactive');
	});

	it('maps active to the success tone and inactive to the neutral tone', () => {
		const active = render(DiscountCodeStatusBadge, { props: { isActive: true } });
		expect(active.container.querySelector('span')?.className).toContain('bg-success');

		const inactive = render(DiscountCodeStatusBadge, { props: { isActive: false } });
		expect(inactive.container.querySelector('span')?.className).toContain('bg-muted');
	});
});
