import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import RefundTicketDialog from './RefundTicketDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const eventadminticketsTicketRefundContext = vi.hoisted(() => vi.fn());
const eventadminticketsRefundTicketPayment = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsTicketRefundContext,
	eventadminticketsRefundTicketPayment
}));

const CONTEXT = {
	payment_method: 'online',
	amount_paid: '20.00',
	currency: 'EUR',
	total_refunded: '5.00',
	total_pending: '0.00',
	remaining_refundable: '15.00',
	policy_suggested_amount: '10.00',
	refunds: [
		{
			id: 'ref-1',
			amount: '5.00',
			currency: 'EUR',
			status: 'succeeded',
			source: 'organizer_api',
			reason: '',
			stripe_refund_id: 're_1',
			failure_reason: '',
			created_at: '2026-08-01T10:00:00Z'
		}
	]
};

function renderDialog(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const onRefunded = vi.fn();
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: RefundTicketDialog,
			componentProps: {
				open: true,
				eventId: 'ev-1',
				ticketId: 'tick-1',
				accessToken: 'tok',
				onClose,
				onRefunded,
				...props
			}
		}
	});
	return { onClose, onRefunded };
}

describe('RefundTicketDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		eventadminticketsTicketRefundContext.mockResolvedValue({ data: CONTEXT, error: undefined });
	});

	it('renders the refund context amounts and quick-select chips', async () => {
		renderDialog();
		expect(await screen.findByText('€20.00')).toBeInTheDocument();
		expect(screen.getByText('€15.00')).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Full remaining (€15.00)' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Policy suggestion (€10.00)' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Custom amount' })).toBeInTheDocument();
	});

	it('submits the full remaining refund with NO amount so the backend computes it', async () => {
		const user = userEvent.setup();
		eventadminticketsRefundTicketPayment.mockResolvedValue({
			data: { ...CONTEXT.refunds[0], amount: '15.00', status: 'pending' },
			error: undefined
		});
		const { onRefunded, onClose } = renderDialog();
		await user.click(await screen.findByRole('button', { name: 'Refund €15.00' }));
		await waitFor(() => expect(onRefunded).toHaveBeenCalled());
		expect(eventadminticketsRefundTicketPayment).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { event_id: 'ev-1', ticket_id: 'tick-1' },
				body: {}
			})
		);
		expect(onClose).toHaveBeenCalled();
	});

	it('submits the policy-suggested amount explicitly, with the trimmed reason', async () => {
		const user = userEvent.setup();
		eventadminticketsRefundTicketPayment.mockResolvedValue({
			data: { ...CONTEXT.refunds[0], amount: '10.00', status: 'pending' },
			error: undefined
		});
		renderDialog();
		await user.click(await screen.findByRole('radio', { name: 'Policy suggestion (€10.00)' }));
		await user.type(screen.getByLabelText('Reason (optional)'), '  goodwill  ');
		await user.click(screen.getByRole('button', { name: 'Refund €10.00' }));
		await waitFor(() =>
			expect(eventadminticketsRefundTicketPayment).toHaveBeenCalledWith(
				expect.objectContaining({ body: { amount: '10.00', reason: 'goodwill' } })
			)
		);
	});

	it('blocks a custom amount above the remaining refundable', async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.click(await screen.findByRole('radio', { name: 'Custom amount' }));
		const input = screen.getByLabelText('Refund amount');
		await user.clear(input);
		await user.type(input, '99');
		// findByText, not findByRole('alert'): the info Alert on this screen
		// also carries role="alert", so the role query matches two nodes.
		expect(
			await screen.findByText('Enter an amount above 0 and no more than €15.00.')
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Refund €99.00' })).toBeDisabled();
		expect(eventadminticketsRefundTicketPayment).not.toHaveBeenCalled();
	});

	it('maps a 402 to the insufficient-balance copy and stays open', async () => {
		const user = userEvent.setup();
		eventadminticketsRefundTicketPayment.mockResolvedValue({
			data: undefined,
			error: { detail: 'balance_insufficient' },
			response: { status: 402 }
		});
		const { onClose, onRefunded } = renderDialog();
		await user.click(await screen.findByRole('button', { name: 'Refund €15.00' }));
		expect(
			await screen.findByText(
				"Your available Stripe balance can't cover this refund. Top up your balance in Stripe, then try again."
			)
		).toBeInTheDocument();
		expect(onRefunded).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('maps a 409 to the nothing-to-refund copy', async () => {
		const user = userEvent.setup();
		eventadminticketsRefundTicketPayment.mockResolvedValue({
			data: undefined,
			error: { detail: 'nothing to refund' },
			response: { status: 409 }
		});
		renderDialog();
		await user.click(await screen.findByRole('button', { name: 'Refund €15.00' }));
		expect(
			await screen.findByText('There is nothing to refund on this payment.')
		).toBeInTheDocument();
	});

	it('shows the fully-refunded state without a submit button when nothing remains', async () => {
		eventadminticketsTicketRefundContext.mockResolvedValue({
			data: { ...CONTEXT, total_refunded: '20.00', remaining_refundable: '0.00', refunds: [] },
			error: undefined
		});
		renderDialog();
		expect(await screen.findByText('This payment has been fully refunded.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^Refund €/ })).not.toBeInTheDocument();
	});

	it('lists the refund history with source and status', async () => {
		renderDialog();
		expect(await screen.findByText('Refund history')).toBeInTheDocument();
		expect(screen.getByText('By organizer', { exact: false })).toBeInTheDocument();
	});

	it('never fires the mutation without an access token', async () => {
		const user = userEvent.setup();
		renderDialog({ accessToken: null });
		// Without a token the context query is disabled, so the dialog stays in
		// the loading state and no submit button exists to fire the mutation.
		expect(screen.queryByRole('button', { name: /^Refund €/ })).not.toBeInTheDocument();
		expect(eventadminticketsTicketRefundContext).not.toHaveBeenCalled();
		expect(eventadminticketsRefundTicketPayment).not.toHaveBeenCalled();
		// keep userEvent referenced (setup already asserted no-op path)
		void user;
	});
});
