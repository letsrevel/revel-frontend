import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import PaymentVoidDialog from './PaymentVoidDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { organizationadminsubscriptionsVoidSubscriptionPayment } from '$lib/api/generated/sdk.gen';
import type { EditablePayment } from './paymentEdit';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsVoidSubscriptionPayment: vi.fn()
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { error: toastErrorMock, success: toastSuccessMock }
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const voidMock = vi.mocked(organizationadminsubscriptionsVoidSubscriptionPayment);

const payment = {
	id: 'pay-1',
	amount: '10.00',
	currency: 'EUR',
	status: 'succeeded',
	notes: '',
	occurred_at: '2026-08-03T10:00:00Z',
	created_at: '2026-08-05T00:00:00Z',
	can_edit: true,
	can_void: true
} as EditablePayment;

function respond(result: { data?: unknown; error?: unknown }) {
	voidMock.mockResolvedValue({
		data: result.data,
		error: result.error,
		response: { ok: !result.error } as unknown as Response
	} as unknown as Awaited<
		ReturnType<typeof organizationadminsubscriptionsVoidSubscriptionPayment>
	>);
}

function renderDialog() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	const onClose = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: PaymentVoidDialog,
			componentProps: { slug: 'test-org', payment, open: true, onClose }
		}
	});
	return { invalidate, onClose };
}

const confirmButton = () => screen.findByRole('button', { name: 'Void payment' });

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('PaymentVoidDialog', () => {
	it('explains what voiding does before anything is sent', async () => {
		renderDialog();
		expect(
			await screen.findByText(
				/removes this payment from totals and lists and recalculates the membership period/
			)
		).toBeInTheDocument();
		expect(voidMock).not.toHaveBeenCalled();
	});

	it('sends the reason as notes', async () => {
		respond({ data: {} });
		renderDialog();
		await userEvent.type(await screen.findByLabelText('Reason (optional)'), 'Typed twice');
		await userEvent.click(await confirmButton());

		await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
		expect(voidMock.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				path: { slug: 'test-org', payment_id: 'pay-1' },
				body: { notes: 'Typed twice' }
			})
		);
	});

	it('sends no body when no reason is given', async () => {
		respond({ data: {} });
		renderDialog();
		await userEvent.click(await confirmButton());

		await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
		expect(voidMock.mock.calls[0][0].body).toBeUndefined();
	});

	it('on success: toasts that the period was recalculated, closes and invalidates', async () => {
		respond({ data: {} });
		const { invalidate, onClose } = renderDialog();
		await userEvent.click(await confirmButton());

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(toastSuccessMock).toHaveBeenCalledWith(
			'Payment voided. The membership period was recalculated.'
		);
		const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey);
		expect(keys).toEqual(
			expect.arrayContaining([
				['organization', 'test-org', 'subscription-payments'],
				['organization', 'test-org', 'subscription'],
				['organization', 'test-org', 'subscriptions'],
				['organization', 'test-org', 'member-register'],
				['organization', 'test-org', 'member']
			])
		);
	});

	it.each([
		[
			'payment_online',
			"This payment went through Stripe, so it can't be changed here. Manage it in the Stripe Dashboard."
		],
		['payment_refunded', "A refunded payment can't be changed."],
		['payment_voided', 'This payment has already been voided.'],
		['payment_not_latest', "Only the latest payment's date and status can be changed."],
		[
			'subscription_terminal',
			"This subscription has ended, so the date and status of its payments can no longer be changed and its payments can't be voided."
		]
	])('maps the 409 code %s to its own message, refreshes and closes', async (code, message) => {
		respond({ error: { detail: 'untranslated backend text', code } });
		const { invalidate, onClose } = renderDialog();
		await userEvent.click(await confirmButton());

		await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(message));
		expect(onClose).toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalled();
	});

	it('shows any other failure inline and keeps the dialog open', async () => {
		respond({ error: { detail: 'Not found.' } });
		const { onClose } = renderDialog();
		await userEvent.click(await confirmButton());

		expect(await screen.findByRole('alert')).toHaveTextContent('Not found.');
		expect(onClose).not.toHaveBeenCalled();
	});
});
