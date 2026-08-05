import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { PaymentStatus } from '$lib/api/generated/types.gen';
import SubscriptionPaymentsStatusBadge from './SubscriptionPaymentsStatusBadge.svelte';

/**
 * REGRESSION GUARD. The org-wide payments ledger row/card locates this pill by
 * its status text, which since #795 is also its accessible name. Every enum
 * value is pinned, not a sample. See
 * `src/lib/components/members/SubscriptionStatusBadge.test.ts` for the incident
 * this pattern guards against (19 e2e specs broke on one dropped label).
 */
const PAYMENT_STATUS_ORDER: PaymentStatus[] = ['pending', 'succeeded', 'failed', 'refunded'];

const LABELS: Record<PaymentStatus, string> = {
	pending: m['orgAdmin.members.payments.status.pending'](),
	succeeded: m['orgAdmin.members.payments.status.succeeded'](),
	failed: m['orgAdmin.members.payments.status.failed'](),
	refunded: m['orgAdmin.members.payments.status.refunded']()
};

describe('members/SubscriptionPaymentsStatusBadge', () => {
	it.each(PAYMENT_STATUS_ORDER)('renders the %s label on the pill', (status) => {
		render(SubscriptionPaymentsStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	it('maps status to the primitive tone (succeeded -> success, failed -> danger, refunded -> neutral)', () => {
		const succeeded = render(SubscriptionPaymentsStatusBadge, { props: { status: 'succeeded' } });
		expect(succeeded.container.querySelector('span')?.className).toContain('bg-success');

		const failed = render(SubscriptionPaymentsStatusBadge, { props: { status: 'failed' } });
		expect(failed.container.querySelector('span')?.className).toContain('bg-destructive');

		const refunded = render(SubscriptionPaymentsStatusBadge, { props: { status: 'refunded' } });
		expect(refunded.container.querySelector('span')?.className).toContain('bg-muted');
	});
});
