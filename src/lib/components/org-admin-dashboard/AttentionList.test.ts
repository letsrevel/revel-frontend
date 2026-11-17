import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import AttentionList from './AttentionList.svelte';

function renderList(awaitingPaymentCount: number | null) {
	return render(AttentionList, {
		props: {
			pendingRequestCount: 0,
			billingNeedsAttention: false,
			draftCount: 0,
			awaitingPaymentCount,
			orgSlug: 'club',
			isOwner: false
		}
	});
}

describe('AttentionList awaiting-payment item', () => {
	it('shows the count and links to pending subscriptions', () => {
		renderList(3);
		expect(screen.getByText('3 awaiting first payment')).toBeInTheDocument();
		const link = screen.getByRole('link', { name: /Review/ });
		expect(link.getAttribute('href')).toContain('tab=subscriptions');
		expect(link.getAttribute('href')).toContain('status=pending');
		expect(link.getAttribute('href')).toContain('payment_method=offline');
	});

	it.each([0, null])('is hidden for %s', (count) => {
		renderList(count);
		expect(screen.queryByText(/awaiting first payment/)).not.toBeInTheDocument();
	});
});
