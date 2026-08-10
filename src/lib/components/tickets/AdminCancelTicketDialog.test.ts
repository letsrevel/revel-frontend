import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import AdminCancelTicketDialog from './AdminCancelTicketDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const eventadminticketsTicketRefundContext = vi.hoisted(() => vi.fn());
const eventadminticketsCancelTicket = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsTicketRefundContext,
	eventadminticketsCancelTicket
}));

const CONTEXT = {
	payment_method: 'online',
	amount_paid: '20.00',
	currency: 'EUR',
	total_refunded: '0.00',
	total_pending: '0.00',
	remaining_refundable: '20.00',
	policy_suggested_amount: '10.00',
	refunds: []
};

function renderDialog(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const onCancelled = vi.fn();
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: AdminCancelTicketDialog,
			componentProps: {
				open: true,
				eventId: 'ev-1',
				ticketId: 'tick-1',
				accessToken: 'tok',
				onClose,
				onCancelled,
				...props
			}
		}
	});
	return { onClose, onCancelled };
}

describe('AdminCancelTicketDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		eventadminticketsTicketRefundContext.mockResolvedValue({ data: CONTEXT, error: undefined });
	});

	it('cancels without a refund by default (null body)', async () => {
		const user = userEvent.setup();
		eventadminticketsCancelTicket.mockResolvedValue({ data: { id: 'tick-1' }, error: undefined });
		const { onCancelled, onClose } = renderDialog();
		// Wait for the refund section so the submit reflects the loaded context.
		await screen.findByLabelText('Also refund the attendee');
		await user.click(screen.getByRole('button', { name: 'Cancel Ticket' }));
		await waitFor(() => expect(onCancelled).toHaveBeenCalled());
		expect(eventadminticketsCancelTicket).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { event_id: 'ev-1', ticket_id: 'tick-1' },
				body: null
			})
		);
		expect(onClose).toHaveBeenCalled();
	});

	it('sends the refund amount when opted in, prefilled from the policy suggestion', async () => {
		const user = userEvent.setup();
		eventadminticketsCancelTicket.mockResolvedValue({ data: { id: 'tick-1' }, error: undefined });
		renderDialog();
		await user.click(await screen.findByLabelText('Also refund the attendee'));
		await user.click(screen.getByRole('button', { name: 'Cancel Ticket' }));
		await waitFor(() =>
			expect(eventadminticketsCancelTicket).toHaveBeenCalledWith(
				expect.objectContaining({ body: { refund_amount: '10.00' } })
			)
		);
	});

	it('blocks a refund amount above the remaining refundable', async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.click(await screen.findByLabelText('Also refund the attendee'));
		const input = screen.getByLabelText('Refund amount');
		await user.clear(input);
		await user.type(input, '999');
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Enter an amount above 0 and no more than €20.00.'
		);
		expect(screen.getByRole('button', { name: 'Cancel Ticket' })).toBeDisabled();
		expect(eventadminticketsCancelTicket).not.toHaveBeenCalled();
	});

	it('shows an error with retry when the refund context fails to load', async () => {
		eventadminticketsTicketRefundContext.mockResolvedValue({
			data: undefined,
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		renderDialog();
		// The refund section can't render without the context — the dialog says
		// so instead of silently offering a refundless cancel.
		expect(await screen.findByText('Could not load the payment details.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
	});

	it('maps a 402 to the insufficient-balance copy and stays open', async () => {
		const user = userEvent.setup();
		eventadminticketsCancelTicket.mockResolvedValue({
			data: undefined,
			error: { detail: 'balance_insufficient' },
			response: { status: 402 }
		});
		const { onCancelled, onClose } = renderDialog();
		await user.click(await screen.findByLabelText('Also refund the attendee'));
		await user.click(screen.getByRole('button', { name: 'Cancel Ticket' }));
		expect(
			await screen.findByText(
				"Your available Stripe balance can't cover this refund. Top up your balance in Stripe, then try again."
			)
		).toBeInTheDocument();
		expect(onCancelled).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});
});
