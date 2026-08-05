import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import RefundStatusBadge, {
	REFUND_STATUS_ORDER,
	type KnownRefundStatus
} from './RefundStatusBadge.svelte';

/**
 * REGRESSION GUARD. The ticket table / card list locate this pill by its
 * status text, which since #795 is also its accessible name — the badge is
 * addressed as `status-badge` + that text, and nothing hidden supplies it. Every
 * enum value is pinned, not a sample. See
 * `src/lib/components/members/SubscriptionStatusBadge.test.ts` for the incident
 * this pattern guards against (19 e2e specs broke on one dropped label).
 */
const LABELS: Record<KnownRefundStatus, string> = {
	succeeded: m['adminTicketTable.refundStatus.succeeded'](),
	pending: m['adminTicketTable.refundStatus.pending'](),
	failed: m['adminTicketTable.refundStatus.failed']()
};

describe('tickets/RefundStatusBadge', () => {
	it.each(REFUND_STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(RefundStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('renders nothing for an unknown/null status — never mislabels as "failed"', () => {
		const { container } = render(RefundStatusBadge, { props: { status: null } });
		expect(container.querySelector('span')).toBeNull();
	});

	it('maps status to the primitive tone (succeeded -> success, failed -> danger)', () => {
		const succeeded = render(RefundStatusBadge, { props: { status: 'succeeded' } });
		expect(succeeded.container.querySelector('span')?.className).toContain('bg-success');

		const failed = render(RefundStatusBadge, { props: { status: 'failed' } });
		expect(failed.container.querySelector('span')?.className).toContain('bg-destructive');
	});

	it('carries the amount+currency tooltip via title', () => {
		render(RefundStatusBadge, {
			props: { status: 'succeeded', amount: '12.00', currency: 'EUR' }
		});
		expect(screen.getByTestId('status-badge')).toHaveAttribute('title', '12.00 EUR');
	});
});
