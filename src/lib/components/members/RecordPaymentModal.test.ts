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

	it('does not warn while the amount field is empty', async () => {
		open();
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		expect(screen.queryByText(warning)).not.toBeInTheDocument();
		expect(amount).not.toHaveAttribute('aria-describedby');
	});

	it('keeps the status region in the accessibility tree while empty', async () => {
		open();
		await screen.findByLabelText('Amount');
		const region = screen.getByRole('status');
		expect(region.className).not.toContain('contents');
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

describe('RecordPaymentModal calendar first-period prefill', () => {
	const calendarSub = (status: string) =>
		({
			id: 'sub-2',
			status,
			plan: {
				price: '12.00',
				currency: 'EUR',
				period_alignment: 'calendar',
				period_unit: 'month',
				first_period_end: '2027-01-01T00:00:00Z',
				first_period_price: '4.00'
			}
		}) as unknown as SubscriptionSchema;
	const open = (sub: SubscriptionSchema) =>
		render(RecordPaymentModal, {
			props: { subscription: sub, open: true, onClose: vi.fn(), onSubmit: vi.fn() }
		});

	it('prefills the first-period price for a pending calendar subscription, with a hint', async () => {
		open(calendarSub('pending'));
		const amount = await screen.findByLabelText('Amount');
		expect(amount).toHaveValue(4);
		expect(screen.getByText(/First period until December 31, 2026/)).toBeInTheDocument();
		// The suggestion is the expected amount: no warning until it is edited.
		expect(screen.queryByText(/different from the plan price/)).not.toBeInTheDocument();
		await userEvent.clear(amount);
		await userEvent.type(amount, '12');
		expect(screen.getByText(/different from the plan price/)).toBeInTheDocument();
	});

	it('uses the full plan price when the subscription is not pending', async () => {
		open(calendarSub('active'));
		expect(await screen.findByLabelText('Amount')).toHaveValue(12);
		expect(screen.queryByText(/First period until/)).not.toBeInTheDocument();
	});

	it('says full price (not partial) for a full-pricing plan', async () => {
		const sub = calendarSub('pending');
		(sub.plan as unknown as Record<string, unknown>).first_period_pricing = 'full';
		(sub.plan as unknown as Record<string, unknown>).first_period_price = '12.00';
		open(sub);
		expect(await screen.findByText(/full price, whatever part is left/)).toBeInTheDocument();
		expect(screen.queryByText(/partial price/)).not.toBeInTheDocument();
	});

	it('says the first period is free when the quote is zero', async () => {
		const sub = calendarSub('pending');
		(sub.plan as unknown as Record<string, unknown>).first_period_price = '0.00';
		open(sub);
		expect(await screen.findByText(/December 31, 2026 is free/)).toBeInTheDocument();
	});
});
