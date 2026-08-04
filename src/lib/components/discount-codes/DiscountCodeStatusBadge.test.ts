import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import DiscountCodeStatusBadge from './DiscountCodeStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/StatusBadge.test.ts`: this pill's
 * accessible NAME is what locates a code's active/inactive state in the
 * discount-codes admin table and its mobile card twin.
 */
describe('discount-codes/DiscountCodeStatusBadge', () => {
	it('exposes "Active" as the accessible name when active', () => {
		render(DiscountCodeStatusBadge, { props: { isActive: true } });
		expect(screen.getByLabelText('Active')).toBeInTheDocument();
		expect(screen.getByLabelText('Active')).toHaveTextContent('Active');
	});

	it('exposes "Inactive" as the accessible name when inactive', () => {
		render(DiscountCodeStatusBadge, { props: { isActive: false } });
		expect(screen.getByLabelText('Inactive')).toBeInTheDocument();
		expect(screen.getByLabelText('Inactive')).toHaveTextContent('Inactive');
	});

	it('maps active to the success tone and inactive to the neutral tone', () => {
		const active = render(DiscountCodeStatusBadge, { props: { isActive: true } });
		expect(active.container.querySelector('span')?.className).toContain('bg-success');

		const inactive = render(DiscountCodeStatusBadge, { props: { isActive: false } });
		expect(inactive.container.querySelector('span')?.className).toContain('bg-muted');
	});
});
