import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { PaymentStatus } from '$lib/api/generated/types.gen';
import SubscriptionPaymentsStatusBadge from './SubscriptionPaymentsStatusBadge.svelte';

/**
 * REGRESSION GUARD. `common/StatusBadge` names itself from its text content,
 * not from an implicit prop — a mapper that forgets `aria-label` silently
 * un-names its pill for every `getByLabel` lookup on the org-wide payments
 * ledger row/card. See `src/lib/components/members/StatusBadge.test.ts` for
 * the incident this pattern guards against (19 e2e specs broke on exactly
 * this omission).
 */
const PAYMENT_STATUS_ORDER: PaymentStatus[] = ['pending', 'succeeded', 'failed', 'refunded'];

const LABELS: Record<PaymentStatus, string> = {
	pending: m['orgAdmin.members.payments.status.pending'](),
	succeeded: m['orgAdmin.members.payments.status.succeeded'](),
	failed: m['orgAdmin.members.payments.status.failed'](),
	refunded: m['orgAdmin.members.payments.status.refunded']()
};

describe('members/SubscriptionPaymentsStatusBadge', () => {
	it.each(PAYMENT_STATUS_ORDER)('exposes the %s label as the pill accessible name', (status) => {
		render(SubscriptionPaymentsStatusBadge, { props: { status } });
		const label = LABELS[status];
		expect(screen.getByLabelText(label)).toBeInTheDocument();
		expect(screen.getByLabelText(label)).toHaveTextContent(label);
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
