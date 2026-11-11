import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CheckInDialog from './CheckInDialog.svelte';
import { toCheckInTicket } from './checkin-adapter';
import type { AdminTicketDetailSchema, AdminTicketSchema } from '$lib/api/generated/types.gen';

const base = {
	id: 'tkt-1',
	status: 'active',
	user: { first_name: 'Ada', last_name: 'L', email: 'ada@example.com' },
	tier: { name: 'General', payment_method: 'free', price_type: 'fixed' }
};

function renderDialog(ticket: ReturnType<typeof toCheckInTicket>) {
	render(CheckInDialog, {
		props: {
			isOpen: true,
			ticket,
			needsPaymentConfirmation: false,
			onConfirm: vi.fn(),
			onCancel: vi.fn()
		}
	});
}

describe('CheckInDialog staff note before confirming (#1165/#1167)', () => {
	it('shows the note from the single-ticket GET before the person is checked in', () => {
		const detail = { ...base, private_note: 'Needs **step-free** access' };
		renderDialog(toCheckInTicket(detail as unknown as AdminTicketDetailSchema));

		const callout = screen.getByTestId('scan-callout');
		expect(callout).toHaveTextContent('Staff note');
		expect(callout).toHaveTextContent('Needs step-free access');
		// Still unconfirmed: the check-in button is there.
		expect(screen.getByRole('button', { name: /^check in$/i })).toBeInTheDocument();
	});

	it('shows no callout for a list row, which carries no note', () => {
		renderDialog(toCheckInTicket(base as unknown as AdminTicketSchema));
		expect(screen.queryByTestId('scan-callout')).not.toBeInTheDocument();
	});

	it('shows no callout when the server gated the note to null', () => {
		const detail = { ...base, private_note: null };
		renderDialog(toCheckInTicket(detail as unknown as AdminTicketDetailSchema));
		expect(screen.queryByTestId('scan-callout')).not.toBeInTheDocument();
	});
});

describe('toCheckInTicket', () => {
	it('carries private_note through explicitly', () => {
		const ticket = toCheckInTicket({
			...base,
			private_note: 'VIP'
		} as unknown as AdminTicketDetailSchema);
		expect(ticket.private_note).toBe('VIP');
	});

	it('leaves private_note undefined for list rows', () => {
		expect(toCheckInTicket(base as unknown as AdminTicketSchema).private_note).toBeUndefined();
	});
});
