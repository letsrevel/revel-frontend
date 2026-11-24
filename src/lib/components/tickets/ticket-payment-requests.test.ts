import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsConfirmTicketPayment: vi.fn(),
	eventadminticketsUnconfirmTicketPayment: vi.fn()
}));

import {
	eventadminticketsConfirmTicketPayment,
	eventadminticketsUnconfirmTicketPayment
} from '$lib/api/generated/sdk.gen';
import {
	requestConfirmTicketPayment,
	requestUnconfirmTicketPayment
} from './ticket-payment-requests';

const base = { eventId: 'e1', ticketId: 't1', accessToken: 'tok', fallbackMessage: 'Fallback' };

beforeEach(() => vi.clearAllMocks());

describe('requestConfirmTicketPayment', () => {
	it('sends price_paid and the bearer token, returns the data', async () => {
		vi.mocked(eventadminticketsConfirmTicketPayment).mockResolvedValue({
			data: { id: 't1' }
		} as never);
		await expect(requestConfirmTicketPayment({ ...base, pricePaid: '12.50' })).resolves.toEqual({
			id: 't1'
		});
		expect(eventadminticketsConfirmTicketPayment).toHaveBeenCalledWith({
			path: { event_id: 'e1', ticket_id: 't1' },
			body: { price_paid: '12.50' },
			headers: { Authorization: 'Bearer tok' }
		});
	});

	it.each([400, 409])('throws the backend detail on a %i', async (status) => {
		vi.mocked(eventadminticketsConfirmTicketPayment).mockResolvedValue({
			error: { detail: 'This ticket is no longer pending.' },
			response: { status }
		} as never);
		await expect(requestConfirmTicketPayment(base)).rejects.toThrow(
			'This ticket is no longer pending.'
		);
	});

	it('falls back to the translated message when the error has no detail', async () => {
		vi.mocked(eventadminticketsConfirmTicketPayment).mockResolvedValue({ error: {} } as never);
		await expect(requestConfirmTicketPayment(base)).rejects.toThrow('Fallback');
	});
});

describe('requestUnconfirmTicketPayment', () => {
	it.each([400, 409])('throws the backend detail on a %i', async (status) => {
		vi.mocked(eventadminticketsUnconfirmTicketPayment).mockResolvedValue({
			error: { detail: 'Ticket state changed.' },
			response: { status }
		} as never);
		await expect(requestUnconfirmTicketPayment(base)).rejects.toThrow('Ticket state changed.');
	});

	it('resolves with the data on success', async () => {
		vi.mocked(eventadminticketsUnconfirmTicketPayment).mockResolvedValue({
			data: { id: 't1' }
		} as never);
		await expect(requestUnconfirmTicketPayment(base)).resolves.toEqual({ id: 't1' });
	});
});
