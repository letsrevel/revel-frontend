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

describe('AttentionList setting warnings (A1, A4)', () => {
	const base = {
		pendingRequestCount: 0,
		billingNeedsAttention: false,
		draftCount: 0,
		orgSlug: 'club',
		isOwner: true
	};
	const counts = { publicEventCount: 4, inSeriesCount: 0, partial: false };

	it('shows A1 with the count and a link to the visibility field', () => {
		render(AttentionList, {
			props: { ...base, orgVisibility: 'private', warningCounts: counts }
		});
		expect(screen.getByText(/This organization is not public/)).toBeInTheDocument();
		expect(screen.getByText(/Upcoming events that visitors can see: 4\./)).toBeInTheDocument();
		expect(screen.queryByText(/series/)).not.toBeInTheDocument();
		const link = screen.getByRole('link', { name: /Open settings/ });
		expect(link.getAttribute('href')).toBe('/org/club/admin/settings#visibility');
	});

	it('mentions the series case when an affected event is in a series', () => {
		render(AttentionList, {
			props: {
				...base,
				orgVisibility: 'members-only',
				warningCounts: { ...counts, inSeriesCount: 1 }
			}
		});
		expect(screen.getByText(/in a series/)).toBeInTheDocument();
	});

	it.each([
		['public org', { orgVisibility: 'public', warningCounts: counts }],
		['unknown counts', { orgVisibility: 'private', warningCounts: null }],
		['no events', { orgVisibility: 'private', warningCounts: { ...counts, publicEventCount: 0 } }]
	])('hides A1 for %s', (_n, extra) => {
		render(AttentionList, { props: { ...base, ...extra } });
		expect(screen.queryByText(/This organization is not public/)).not.toBeInTheDocument();
	});

	it('shows A4 only when requests are accepted and the org is restricted', () => {
		const { unmount } = render(AttentionList, {
			props: { ...base, orgVisibility: 'private', acceptMembershipRequests: true }
		});
		expect(screen.getByText('Membership requests are not reachable')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open settings/ }).getAttribute('href')).toBe(
			'/org/club/admin/settings#accept_membership_requests'
		);
		unmount();
		render(AttentionList, {
			props: { ...base, orgVisibility: 'public', acceptMembershipRequests: true }
		});
		expect(screen.queryByText('Membership requests are not reachable')).not.toBeInTheDocument();
	});

	it('never shows A5 and keeps the single Review link query unambiguous', () => {
		render(AttentionList, {
			props: {
				...base,
				pendingRequestCount: 2,
				orgVisibility: 'private',
				warningCounts: counts
			}
		});
		expect(screen.queryByText(/custom domain/i)).not.toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: /Review/ })).toHaveLength(1);
	});
});
