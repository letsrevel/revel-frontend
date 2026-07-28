import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipPaymentHistory from './MembershipPaymentHistory.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MyMembershipPaymentSchema } from '$lib/api/generated/types.gen';
import { formatDate } from '$lib/utils/date';

const paymentsMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsListMySubscriptionPayments: paymentsMock
}));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

function makePayment(
	overrides: Partial<MyMembershipPaymentSchema> = {}
): MyMembershipPaymentSchema {
	return {
		id: 'pay-1',
		amount: '10.00',
		currency: 'EUR',
		status: 'succeeded',
		created_at: '2026-08-01T00:00:00Z',
		period_start: '2026-08-01T00:00:00Z',
		period_end: '2026-09-01T00:00:00Z',
		refund_amount: null,
		refunded_at: null,
		...overrides
	};
}

function page(results: MyMembershipPaymentSchema[], count = results.length) {
	return { data: { count, next: null, previous: null, results }, error: undefined };
}

describe('MembershipPaymentHistory', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	function renderHistory(organizationId = 'org-1') {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: MembershipPaymentHistory,
				componentProps: { organizationId }
			}
		});
	}

	async function open() {
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: /payment history/i }));
		return user;
	}

	it('exposes the disclosure state to assistive tech and starts collapsed', () => {
		paymentsMock.mockResolvedValue(page([makePayment()]));
		renderHistory();

		const toggle = screen.getByRole('button', { name: /payment history/i });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		// The panel exists even while collapsed, so `aria-controls` always resolves.
		const panelId = toggle.getAttribute('aria-controls');
		expect(panelId).toBeTruthy();
		expect(document.getElementById(panelId as string)).toBeTruthy();
		expect(paymentsMock).not.toHaveBeenCalled();
	});

	it('fetches the org-scoped first page only once opened', async () => {
		paymentsMock.mockResolvedValue(page([makePayment()]));
		renderHistory('org-42');

		await open();

		await waitFor(() =>
			expect(paymentsMock).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_id: 'org-42' },
					query: { page: 1, page_size: 20 }
				})
			)
		);
		expect(await screen.findByText('€10.00')).toBeInTheDocument();
	});

	it('renders the covered period with a textual month, never a numeric one', async () => {
		paymentsMock.mockResolvedValue(page([makePayment()]));
		renderHistory();

		await open();

		expect(
			await screen.findByText(
				`Covers ${formatDate('2026-08-01T00:00:00Z')} – ${formatDate('2026-09-01T00:00:00Z')}`
			)
		).toBeInTheDocument();
	});

	/**
	 * A partial refund deliberately leaves `status = 'succeeded'`, so the status
	 * column alone cannot reveal that part of the money came back.
	 */
	it('annotates a partial refund that the status column cannot show', async () => {
		paymentsMock.mockResolvedValue(
			page([
				makePayment({
					refund_amount: '4.00',
					refunded_at: '2026-08-10T00:00:00Z'
				})
			])
		);
		renderHistory();

		await open();

		expect(
			await screen.findByText(`€4.00 refunded on ${formatDate('2026-08-10T00:00:00Z')}`)
		).toBeInTheDocument();
		expect(screen.getByText('Paid')).toBeInTheDocument();
	});

	// A full refund flips the status to `refunded`, which the status column already
	// says — annotating it too would double up.
	it('does not annotate a full refund', async () => {
		paymentsMock.mockResolvedValue(
			page([makePayment({ status: 'refunded', refund_amount: '10.00' })])
		);
		renderHistory();

		await open();

		expect(await screen.findByText('Refunded')).toBeInTheDocument();
		expect(screen.queryByText(/refunded on/i)).toBeNull();
		expect(screen.queryByText('€10.00 refunded')).toBeNull();
	});

	it('shows an empty state rather than an empty table', async () => {
		paymentsMock.mockResolvedValue(page([]));
		renderHistory();

		await open();

		expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('reports a failure as an alert and offers a retry', async () => {
		paymentsMock.mockResolvedValue({ data: undefined, error: { detail: 'Nope.' } });
		renderHistory();

		await open();

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Nope.');
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
	});

	/**
	 * The server hands back 20 rows at a time — without a pager a member with a
	 * long history would be silently truncated at their most recent year.
	 */
	it('pages through a history longer than one server page', async () => {
		const first = Array.from({ length: 20 }, (_, i) =>
			makePayment({ id: `p${i}`, amount: `${i + 1}.00` })
		);
		paymentsMock.mockResolvedValueOnce(page(first, 25));
		renderHistory();

		const user = await open();

		expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

		paymentsMock.mockResolvedValueOnce(page([makePayment({ id: 'p20', amount: '99.00' })], 25));
		await user.click(screen.getByRole('button', { name: 'Next' }));

		await waitFor(() =>
			expect(paymentsMock).toHaveBeenLastCalledWith(
				expect.objectContaining({ query: { page: 2, page_size: 20 } })
			)
		);
		expect(await screen.findByText('€99.00')).toBeInTheDocument();
		expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('hides the pager when everything fits on one page', async () => {
		paymentsMock.mockResolvedValue(page([makePayment()]));
		renderHistory();

		await open();

		await screen.findByText('€10.00');
		expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
	});
});
