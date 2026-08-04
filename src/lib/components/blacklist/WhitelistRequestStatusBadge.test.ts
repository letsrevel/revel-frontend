import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import WhitelistRequestStatusBadge from './WhitelistRequestStatusBadge.svelte';

/**
 * REGRESSION GUARD, mirroring `members/StatusBadge.test.ts`: this pill's
 * accessible NAME is what locates it on `WhitelistRequestCard`. The status
 * text itself is intentionally unlocalized (matches the pre-rebrand
 * behaviour) — this guard is about the aria-label surviving the move to the
 * shared `common/StatusBadge` primitive, not about translation.
 */
describe('blacklist/WhitelistRequestStatusBadge', () => {
	it.each(['pending', 'approved', 'rejected'])(
		'exposes the raw "%s" status as the pill accessible name',
		(status) => {
			render(WhitelistRequestStatusBadge, { props: { status } });
			expect(screen.getByLabelText(status)).toBeInTheDocument();
			expect(screen.getByLabelText(status)).toHaveTextContent(status);
		}
	);

	it('falls back to a warning tone for an unrecognized status rather than throwing', () => {
		const { container } = render(WhitelistRequestStatusBadge, {
			props: { status: 'some_future_status' }
		});
		expect(screen.getByLabelText('some_future_status')).toBeInTheDocument();
		expect(container.querySelector('span')?.className).toContain('bg-highlight');
	});

	it('maps rejected to the danger tone', () => {
		const { container } = render(WhitelistRequestStatusBadge, { props: { status: 'rejected' } });
		expect(container.querySelector('span')?.className).toContain('bg-destructive');
	});
});
