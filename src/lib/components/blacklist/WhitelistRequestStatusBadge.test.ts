import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import WhitelistRequestStatusBadge from './WhitelistRequestStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/SubscriptionStatusBadge.test.ts`: this
 * pill's status text is what locates it on `WhitelistRequestCard`, and since
 * #795 it is the accessible name too. The text itself is intentionally
 * unlocalized (matches the pre-rebrand behaviour) — this guard is about the
 * label surviving the move to the shared primitive, not about translation.
 */
describe('blacklist/WhitelistRequestStatusBadge', () => {
	it.each(['pending', 'approved', 'rejected'])(
		'renders the raw "%s" status on the pill',
		(status) => {
			render(WhitelistRequestStatusBadge, { props: { status } });
			expect(screen.getByTestId('status-badge')).toHaveTextContent(status);
		}
	);

	it('falls back to a warning tone for an unrecognized status rather than throwing', () => {
		const { container } = render(WhitelistRequestStatusBadge, {
			props: { status: 'some_future_status' }
		});
		expect(screen.getByTestId('status-badge')).toHaveTextContent('some_future_status');
		expect(container.querySelector('span')?.className).toContain('bg-highlight');
	});

	it('maps rejected to the danger tone', () => {
		const { container } = render(WhitelistRequestStatusBadge, { props: { status: 'rejected' } });
		expect(container.querySelector('span')?.className).toContain('bg-destructive');
	});
});
