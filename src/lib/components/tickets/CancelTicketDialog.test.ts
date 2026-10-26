import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import CancelTicketDialog from './CancelTicketDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const eventpublicticketsCancellationPreview = vi.hoisted(() => vi.fn());
const eventpublicticketsCancelMyTicket = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicticketsCancellationPreview,
	eventpublicticketsCancelMyTicket
}));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

function renderDialog() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: CancelTicketDialog,
			componentProps: { open: true, ticketId: 'tick-1' }
		}
	});
}

const BASE = {
	can_cancel: true,
	reason: null,
	refund_amount: '0.00',
	flat_fee: '0.00',
	currency: 'EUR',
	refund_windows: [],
	deadline: null
};

describe('CancelTicketDialog', () => {
	beforeEach(() => vi.clearAllMocks());

	it('does not talk about refunds for a free ticket', async () => {
		eventpublicticketsCancellationPreview.mockResolvedValue({
			data: { ...BASE, payment_method: 'free' },
			error: undefined
		});
		renderDialog();
		await waitFor(() =>
			expect(
				screen.getByText('Cancelling releases your spot so someone else can attend.')
			).toBeInTheDocument()
		);
		expect(screen.queryByText(/receive/i)).not.toBeInTheDocument();
		expect(screen.queryByTestId('refund-summary')).not.toBeInTheDocument();
	});

	it('keeps the refund summary for a paid ticket', async () => {
		eventpublicticketsCancellationPreview.mockResolvedValue({
			data: { ...BASE, payment_method: 'online', refund_amount: '10.00' },
			error: undefined
		});
		renderDialog();
		await waitFor(() => expect(screen.getByTestId('refund-summary')).toBeInTheDocument());
	});
});
