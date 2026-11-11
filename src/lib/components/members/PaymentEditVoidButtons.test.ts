import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PaymentEditVoidButtons from './PaymentEditVoidButtons.svelte';
import type { EditablePayment } from './paymentEdit';

function makePayment(overrides: Partial<EditablePayment> = {}): EditablePayment {
	return {
		id: 'pay-1',
		amount: '10.00',
		currency: 'EUR',
		status: 'succeeded',
		notes: '',
		occurred_at: '2026-08-03T10:00:00Z',
		created_at: '2026-08-05T00:00:00Z',
		can_edit: true,
		can_void: true,
		...overrides
	} as EditablePayment;
}

function renderButtons(payment: EditablePayment) {
	const onEdit = vi.fn();
	const onVoid = vi.fn();
	render(PaymentEditVoidButtons, { props: { payment, onEdit, onVoid } });
	return { onEdit, onVoid };
}

describe('PaymentEditVoidButtons', () => {
	it('offers Edit and Void when the backend allows both', () => {
		renderButtons(makePayment());
		expect(screen.getByRole('button', { name: /^Edit the payment of/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^Void the payment of/ })).toBeInTheDocument();
	});

	it('hides Edit when can_edit is false', () => {
		renderButtons(makePayment({ can_edit: false }));
		expect(screen.queryByRole('button', { name: /^Edit the payment of/ })).toBeNull();
		expect(screen.getByRole('button', { name: /^Void the payment of/ })).toBeInTheDocument();
	});

	it('hides Void when can_void is false', () => {
		renderButtons(makePayment({ can_void: false }));
		expect(screen.queryByRole('button', { name: /^Void the payment of/ })).toBeNull();
		expect(screen.getByRole('button', { name: /^Edit the payment of/ })).toBeInTheDocument();
	});

	it('renders nothing for a voided row (neither flag set)', () => {
		renderButtons(makePayment({ status: 'voided', can_edit: false, can_void: false }));
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('names each button with the payment amount and date', () => {
		renderButtons(makePayment());
		const name = screen
			.getByRole('button', { name: /^Edit the payment of/ })
			.getAttribute('aria-label');
		expect(name).toMatch(/10/);
		expect(name).toMatch(/2026/);
	});

	it('hands the payment to the callbacks', async () => {
		const payment = makePayment();
		const { onEdit, onVoid } = renderButtons(payment);
		await userEvent.click(screen.getByRole('button', { name: /^Edit the payment of/ }));
		await userEvent.click(screen.getByRole('button', { name: /^Void the payment of/ }));
		expect(onEdit).toHaveBeenCalledWith(payment);
		expect(onVoid).toHaveBeenCalledWith(payment);
	});

	it('describes the Void button with the explanation, and keeps its name', () => {
		renderButtons(makePayment());
		const voidButton = screen.getByRole('button', { name: /^Void the payment of/ });
		expect(voidButton).toHaveAccessibleDescription(
			'Cancels a payment that was recorded by mistake. It stays in the history but no longer counts, and the paid period is recalculated. If the money was actually paid back, record a Refund instead.'
		);
	});

	it('does not describe the Edit button with the Void explanation', () => {
		renderButtons(makePayment());
		const editButton = screen.getByRole('button', { name: /^Edit the payment of/ });
		expect(editButton).not.toHaveAccessibleDescription(/recorded by mistake/);
	});
});
