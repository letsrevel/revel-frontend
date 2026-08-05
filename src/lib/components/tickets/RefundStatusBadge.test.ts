import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import RefundStatusBadge, {
	REFUND_STATUS_ORDER,
	type KnownRefundStatus
} from './RefundStatusBadge.svelte';

/**
 * REGRESSION GUARD. Before #788 `common/StatusBadge` named itself from its
 * text content alone, so a mapper that forgot `aria-label` silently un-named
 * its pill for every `getByLabel` lookup in the ticket table / card list, even
 * though its own unit tests (which query by text) stayed green. The primitive
 * defaults the name now; this test is what keeps it true either way. See
 * `src/lib/components/members/SubscriptionStatusBadge.test.ts` for the incident this
 * pattern guards against (19 e2e specs broke on exactly this omission).
 */
const LABELS: Record<KnownRefundStatus, string> = {
	succeeded: m['adminTicketTable.refundStatus.succeeded'](),
	pending: m['adminTicketTable.refundStatus.pending'](),
	failed: m['adminTicketTable.refundStatus.failed']()
};

describe('tickets/RefundStatusBadge', () => {
	it.each(REFUND_STATUS_ORDER)('exposes the %s label as the pill accessible name', (status) => {
		render(RefundStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
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
		expect(screen.getByLabelText(LABELS.succeeded)).toHaveAttribute('title', '12.00 EUR');
	});
});
