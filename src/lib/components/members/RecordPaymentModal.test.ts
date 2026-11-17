import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import RecordPaymentModal from './RecordPaymentModal.svelte';
import type { SubscriptionSchema } from '$lib/api/generated/types.gen';

const subscription = {
	id: 'sub-1',
	plan: { price: '10.00', currency: 'EUR' }
} as unknown as SubscriptionSchema;

describe('RecordPaymentModal status options', () => {
	// The record endpoint answers 422 to `voided`: a payment is voided through its
	// own action, never recorded as voided.
	it('does not offer voided (or refunded) as a status to record', async () => {
		render(RecordPaymentModal, {
			props: { subscription, open: true, onClose: vi.fn(), onSubmit: vi.fn() }
		});
		const status = await screen.findByLabelText('Status');
		const values = Array.from(status.querySelectorAll('option')).map((o) => o.value);
		expect(values).toEqual(['succeeded', 'pending', 'failed']);
	});
});

describe('RecordPaymentModal amount warning', () => {
	function open() {
		render(RecordPaymentModal, {
			props: { subscription, open: true, onClose: vi.fn(), onSubmit: vi.fn() }
		});
	}
	const warning = /different from the plan price/;

	it('does not warn when the amount matches numerically ("10" vs "10.00")', async () => {
		open();
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		await userEvent.type(amount, '10');
		expect(screen.queryByText(warning)).not.toBeInTheDocument();
		expect(amount).not.toHaveAttribute('aria-describedby');
	});

	it('warns in a status region when the amount differs, and keeps submit enabled', async () => {
		open();
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		await userEvent.type(amount, '5');
		const note = screen.getByText(warning);
		// The live region is a persistent wrapper, not the (late-mounted) note itself.
		expect(note.parentElement).toHaveAttribute('role', 'status');
		expect(amount).toHaveAttribute('aria-describedby', note.id);
		expect(note).toHaveTextContent('The full period will still be granted.');
		expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
	});

	it('does not warn for a non-succeeded status', async () => {
		open();
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		await userEvent.type(amount, '5');
		await userEvent.selectOptions(screen.getByLabelText('Status'), 'pending');
		expect(screen.queryByText(warning)).not.toBeInTheDocument();
	});
});
