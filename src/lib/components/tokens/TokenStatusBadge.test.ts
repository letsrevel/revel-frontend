import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TokenStatusBadge from './TokenStatusBadge.svelte';

/**
 * REGRESSION GUARD, same shape as `members/SubscriptionStatusBadge.test.ts`:
 * this pill's status text is a cross-surface contract (event admin + org admin
 * token cards locate their status pill by it, and since #795 it is the
 * accessible name too), not decoration. Every status is pinned, not a sample.
 */
const STATUS_ORDER = ['active', 'expired', 'limit-reached', 'staff'] as const;

const LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
	active: 'Active',
	expired: 'Expired',
	'limit-reached': 'Limit Reached',
	staff: 'Staff'
};

describe('tokens/TokenStatusBadge', () => {
	it.each(STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(TokenStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('maps status to the primitive tone (active → success, expired → danger)', () => {
		const active = render(TokenStatusBadge, { props: { status: 'active' } });
		expect(active.container.querySelector('span')?.className).toContain('bg-success');

		const expired = render(TokenStatusBadge, { props: { status: 'expired' } });
		expect(expired.container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('keeps the caller class alongside the tone classes', () => {
		const { container } = render(TokenStatusBadge, {
			props: { status: 'active', class: 'shrink-0' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('shrink-0');
		expect(el.className).toContain('bg-success');
	});
});
