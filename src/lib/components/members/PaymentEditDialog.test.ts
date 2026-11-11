import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import PaymentEditDialog from './PaymentEditDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { organizationadminsubscriptionsUpdateSubscriptionPayment } from '$lib/api/generated/sdk.gen';
import type { EditablePayment } from './paymentEdit';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsUpdateSubscriptionPayment: vi.fn()
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { error: toastErrorMock, success: toastSuccessMock }
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const updateMock = vi.mocked(organizationadminsubscriptionsUpdateSubscriptionPayment);

function makePayment(overrides: Partial<EditablePayment> = {}): EditablePayment {
	return {
		id: 'pay-1',
		amount: '10.00',
		currency: 'EUR',
		status: 'succeeded',
		notes: 'first',
		occurred_at: '2026-08-03T10:00:00Z',
		created_at: '2026-08-05T00:00:00Z',
		can_edit: true,
		can_void: true,
		...overrides
	} as EditablePayment;
}

function respond(result: { data?: unknown; error?: unknown }) {
	updateMock.mockResolvedValue({
		data: result.data,
		error: result.error,
		response: { ok: !result.error } as unknown as Response
	} as unknown as Awaited<
		ReturnType<typeof organizationadminsubscriptionsUpdateSubscriptionPayment>
	>);
}

function renderDialog(payment: EditablePayment = makePayment(), subscriptionStatus?: string) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	const onClose = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: PaymentEditDialog,
			componentProps: { slug: 'test-org', payment, open: true, onClose, subscriptionStatus }
		}
	});
	return { invalidate, onClose };
}

const save = () => screen.getByRole('button', { name: 'Save changes' });

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('PaymentEditDialog fields', () => {
	it('shows the currency read-only', async () => {
		renderDialog();
		const currency = await screen.findByLabelText('Currency');
		expect(currency).toHaveValue('EUR');
		expect(currency).toHaveAttribute('readonly');
	});

	it('lets status and date be edited on the latest payment (can_void)', async () => {
		renderDialog(makePayment({ can_void: true }));
		expect(await screen.findByLabelText('Status')).toBeEnabled();
		expect(screen.getByLabelText('Payment date')).toBeEnabled();
		expect(screen.queryByText(/Only the latest payment's date and status/)).toBeNull();
	});

	it('locks status and date with an explanation when the row is not the latest (!can_void)', async () => {
		renderDialog(makePayment({ can_void: false }), 'active');
		const status = await screen.findByLabelText('Status');
		expect(status).toBeDisabled();
		expect(screen.getByLabelText('Payment date')).toBeDisabled();
		expect(
			screen.getByText("Only the latest payment's date and status can be changed.")
		).toBeInTheDocument();
		// Amount and notes stay editable.
		expect(screen.getByLabelText('Amount')).toBeEnabled();
		expect(screen.getByLabelText('Notes')).toBeEnabled();
	});

	it('names the real lock reason: an ended membership, not "not the latest"', async () => {
		renderDialog(makePayment({ can_void: false }), 'cancelled');
		expect(
			await screen.findByText(/The membership has ended, so the date and status of its payments/)
		).toBeInTheDocument();
		expect(
			screen.queryByText("Only the latest payment's date and status can be changed.")
		).toBeNull();
	});

	it('gives a neutral hint when the subscription status is unknown (org-wide ledger)', async () => {
		renderDialog(makePayment({ can_void: false }));
		expect(await screen.findByText(/and only while the membership is running/)).toBeInTheDocument();
	});

	it('links the disabled date and status to the lock hint for screen readers', async () => {
		renderDialog(makePayment({ can_void: false }), 'active');
		const hint = await screen.findByText(
			"Only the latest payment's date and status can be changed."
		);
		expect(hint.id).toBe('ep-locked-hint');
		expect(screen.getByLabelText('Payment date')).toHaveAttribute(
			'aria-describedby',
			expect.stringContaining('ep-locked-hint')
		);
		expect(screen.getByLabelText('Status')).toHaveAttribute('aria-describedby', 'ep-locked-hint');
	});

	it('keeps Save disabled until something changed', async () => {
		renderDialog();
		await screen.findByLabelText('Amount');
		expect(save()).toBeDisabled();
		await userEvent.type(screen.getByLabelText('Notes'), '!');
		expect(save()).toBeEnabled();
	});
});

describe('PaymentEditDialog submit', () => {
	it('PATCHes only the notes when only the notes changed', async () => {
		respond({ data: {} });
		renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), ' more');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				path: { slug: 'test-org', payment_id: 'pay-1' },
				body: { notes: 'first more' }
			})
		);
	});

	it('PATCHes only the amount when only the amount changed', async () => {
		respond({ data: {} });
		renderDialog();
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		await userEvent.type(amount, '12.50');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock.mock.calls[0][0].body).toEqual({ amount: '12.5' });
	});

	it('sends status and occurred_at when they changed, and nothing else', async () => {
		respond({ data: {} });
		renderDialog();
		await userEvent.selectOptions(await screen.findByLabelText('Status'), 'failed');
		await fireEvent.input(screen.getByLabelText('Payment date'), {
			target: { value: '2026-08-02T09:30' }
		});
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		const body = updateMock.mock.calls[0][0].body;
		expect(Object.keys(body).sort()).toEqual(['occurred_at', 'status']);
		expect(body.status).toBe('failed');
		expect(new Date(body.occurred_at as string).getTime()).toBe(
			new Date('2026-08-02T09:30').getTime()
		);
	});

	it('does not send occurred_at for a notes-only edit, even when the date has seconds', async () => {
		respond({ data: {} });
		renderDialog(makePayment({ occurred_at: '2026-08-03T10:15:42.123Z' }));
		await userEvent.type(await screen.findByLabelText('Notes'), ' more');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock.mock.calls[0][0].body).toEqual({ notes: 'first more' });
	});

	it('never sends status for a notes-only edit', async () => {
		respond({ data: {} });
		renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), '!');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect('status' in updateMock.mock.calls[0][0].body).toBe(false);
	});

	it('shows a status outside the editable set as-is, locked, and never sends it', async () => {
		respond({ data: {} });
		renderDialog(makePayment({ status: 'refunded', can_edit: true, can_void: true }));
		const status = await screen.findByLabelText('Status');
		expect(status).toBeDisabled();
		expect(status).toHaveValue('refunded');
		await userEvent.type(screen.getByLabelText('Notes'), '!');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock.mock.calls[0][0].body).toEqual({ notes: 'first!' });
	});

	it('requires the date once it has been cleared: field error and Save blocked', async () => {
		renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), '!');
		expect(save()).toBeEnabled();
		await fireEvent.input(screen.getByLabelText('Payment date'), { target: { value: '' } });

		expect(await screen.findByText('Pick a payment date.')).toBeInTheDocument();
		expect(save()).toBeDisabled();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('never sends status or date for a locked row, even if the amount changed', async () => {
		respond({ data: {} });
		renderDialog(makePayment({ can_void: false }));
		const amount = await screen.findByLabelText('Amount');
		await userEvent.clear(amount);
		await userEvent.type(amount, '11');
		await userEvent.click(save());

		await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
		expect(updateMock.mock.calls[0][0].body).toEqual({ amount: '11' });
	});

	it('on success: toasts, closes and invalidates payments, subscription, lists and members', async () => {
		respond({ data: {} });
		const { invalidate, onClose } = renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), 'x');
		await userEvent.click(save());

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(toastSuccessMock).toHaveBeenCalledWith('Payment updated.');
		const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey);
		expect(keys).toEqual(
			expect.arrayContaining([
				['organization', 'test-org', 'subscription-payments'],
				['organization', 'test-org', 'subscription'],
				['organization', 'test-org', 'subscriptions'],
				['organization', 'test-org', 'members'],
				['organization', 'test-org', 'member-register'],
				['organization', 'test-org', 'member']
			])
		);
	});

	it('shows a 400 inline and keeps the dialog open', async () => {
		respond({ error: { detail: 'The payment date cannot be in the future.' } });
		const { onClose } = renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), 'x');
		await userEvent.click(save());

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The payment date cannot be in the future.'
		);
		expect(onClose).not.toHaveBeenCalled();
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
		// `detail` is deliberately different: the UI must branch on `code`, not on text.
		respond({ error: { detail: 'untranslated backend text', code } });
		const { invalidate, onClose } = renderDialog();
		await userEvent.type(await screen.findByLabelText('Notes'), 'x');
		await userEvent.click(save());

		await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(message));
		expect(onClose).toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalled();
	});
});
