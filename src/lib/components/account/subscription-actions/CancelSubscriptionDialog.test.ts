import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';
import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';

const cancelMock = vi.hoisted(() => vi.fn());
const orgMock = vi.hoisted(() => vi.fn());
const plansMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsCancelSubscription: cancelMock,
	organizationGetOrganization: orgMock,
	organizationListMembershipPlans: plansMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { success: toastSuccessMock, error: toastErrorMock }
}));

const sub = {
	plan_id: 'p1',
	organization_id: 'o1',
	organization_name: 'Org',
	organization_slug: 'org',
	status: 'active',
	current_period_end: '2026-08-01T00:00:00Z',
	cancel_at_period_end: false,
	created_at: '2026-07-01T00:00:00Z',
	updated_at: '2026-07-01T00:00:00Z',
	plan: {
		id: 'p1',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Monthly',
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open'
	}
} as never;

function renderDialog(props: Record<string, unknown> = {}, client?: QueryClient) {
	return render(QueryClientTestWrapper, {
		props: {
			client: client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: CancelSubscriptionDialog,
			componentProps: { open: true, onOpenChange: vi.fn(), sub, ...props }
		}
	});
}

/** Tick the immediate radio + its confirmation — the only path that can 409. */
async function chooseImmediate(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('radio', { name: /immediately/i }));
	await user.click(screen.getByRole('checkbox', { name: /ends immediately/i }));
}

beforeEach(() => {
	toastSuccessMock.mockReset();
	toastErrorMock.mockReset();
	cancelMock.mockReset();
	orgMock.mockReset().mockResolvedValue({
		data: { membership_refund_policy: 'No refunds after 14 days.' },
		error: undefined
	});
	plansMock
		.mockReset()
		.mockResolvedValue({ data: [{ id: 'p2', name: 'Yearly' }], error: undefined });
});

describe('CancelSubscriptionDialog', () => {
	it('defaults to period-end and submits immediate: false', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue({
			data: { ...sub, cancel_at_period_end: true },
			error: undefined
		});
		renderDialog();
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));
		await waitFor(() =>
			expect(cancelMock).toHaveBeenCalledWith(
				expect.objectContaining({ body: { immediate: false }, path: { org_id: 'o1' } })
			)
		);
	});

	it('blocks immediate cancellation until the checkbox is ticked', async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.click(screen.getByRole('radio', { name: /immediately/i }));
		expect(screen.getByRole('button', { name: /cancel membership/i })).toBeDisabled();
		await user.click(screen.getByRole('checkbox', { name: /ends immediately/i }));
		expect(screen.getByRole('button', { name: /cancel membership/i })).toBeEnabled();
	});

	it('submits immediate: true once confirmed and closes itself on success', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue({
			data: { ...sub, status: 'cancelled', cancel_at_period_end: false },
			error: undefined
		});
		const onOpenChange = vi.fn();
		renderDialog({ onOpenChange });
		await user.click(screen.getByRole('radio', { name: /immediately/i }));
		await user.click(screen.getByRole('checkbox', { name: /ends immediately/i }));
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));
		await waitFor(() =>
			expect(cancelMock).toHaveBeenCalledWith(
				expect.objectContaining({ body: { immediate: true }, path: { org_id: 'o1' } })
			)
		);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it('renders the refund policy fetched from the public org endpoint', async () => {
		renderDialog();
		expect(await screen.findByText(/no refunds after 14 days/i)).toBeInTheDocument();
	});

	// The backend never refunds on cancel (refunds are staff-initiated only), so
	// "ends right away" on its own reads as if the unused time comes back.
	it('warns that the remaining paid time is not refunded automatically', () => {
		renderDialog();
		expect(
			screen.getByText(/remaining paid time is not refunded automatically/i)
		).toBeInTheDocument();
	});

	it('points at the refund policy only once one has actually loaded', async () => {
		renderDialog();
		expect(await screen.findByText(/see the refund policy below/i)).toBeInTheDocument();
	});

	// Pointing at a <details> the org never authored would send the member looking
	// for something that is not on screen.
	it('omits the refund-policy pointer when the organization has no policy', async () => {
		orgMock.mockResolvedValue({ data: { membership_refund_policy: null }, error: undefined });
		renderDialog();
		await waitFor(() => expect(orgMock).toHaveBeenCalled());
		expect(screen.queryByText(/see the refund policy below/i)).toBeNull();
		expect(screen.queryByText(/refund policy/i)).toBeNull();
	});

	// A period-end cancel terminalizes as CANCELLED with `expired_at` unset, and
	// the backend only revives EXPIRED rows — so there is no rejoin window.
	it('says a period-end cancellation cannot be revived later', () => {
		renderDialog();
		expect(
			screen.getByText(/rejoining later means starting a new subscription/i)
		).toBeInTheDocument();
	});

	it('names the queued plan change that cancelling will drop', async () => {
		renderDialog({ sub: { ...(sub as object), pending_plan_id: 'p2' } });
		expect(
			await screen.findByText('Your scheduled switch to Yearly will be dropped.')
		).toBeInTheDocument();
		await waitFor(() =>
			expect(plansMock).toHaveBeenCalledWith(expect.objectContaining({ path: { slug: 'org' } }))
		);
	});

	it('still warns about the dropped switch when the plan catalogue fails to load', async () => {
		plansMock.mockResolvedValue({ data: undefined, error: { detail: 'boom' } });
		renderDialog({ sub: { ...(sub as object), pending_plan_id: 'p2' } });
		expect(
			await screen.findByText('Your scheduled switch to another plan will be dropped.')
		).toBeInTheDocument();
	});

	it('says nothing about a dropped switch when none is queued', async () => {
		renderDialog();
		await waitFor(() => expect(orgMock).toHaveBeenCalled());
		expect(screen.queryByText(/will be dropped/i)).toBeNull();
		expect(plansMock).not.toHaveBeenCalled();
	});

	// #693: the cancel 200 is the only snapshot guaranteed to describe what the
	// member just asked for — Stripe's webhooks can make the backend contradict it
	// moments later — so the dialog seeds it into every member-facing cache rather
	// than trusting the refetch alone.
	it('seeds the truthful response body into the member-facing caches', async () => {
		const user = userEvent.setup();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const stale = { ...(sub as object), id: 'sub-1' } as MySubscriptionSchema;
		const truthful: MySubscriptionSchema = { ...stale, cancel_at_period_end: true };
		client.setQueryData(['me', 'memberships'], [
			{
				organization_id: 'o1',
				organization_name: 'Org',
				organization_slug: 'org',
				member_since: '2026-01-01T00:00:00Z',
				status: 'active',
				subscription: stale
			}
		] satisfies MyMembershipSchema[]);
		client.setQueryData(['me', 'subscriptions'], [stale]);
		client.setQueryData(['me', 'org', 'o1', 'subscription'], stale);
		cancelMock.mockResolvedValue({ data: truthful, error: undefined });

		renderDialog({}, client);
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		await waitFor(() => {
			expect(
				client.getQueryData<MyMembershipSchema[]>(['me', 'memberships'])?.[0].subscription
					?.cancel_at_period_end
			).toBe(true);
		});
		expect(
			client.getQueryData<MySubscriptionSchema[]>(['me', 'subscriptions'])?.[0].cancel_at_period_end
		).toBe(true);
		expect(
			client.getQueryData<MySubscriptionSchema>(['me', 'org', 'o1', 'subscription'])
				?.cancel_at_period_end
		).toBe(true);
	});

	it('surfaces a backend 400 detail inline', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Already cancelled at period end.' }
		});
		renderDialog();
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Already cancelled at period end.');
	});
});

/**
 * The 409 `subscription_activation_pending`: an immediate cancel found the
 * member's hosted Checkout Session already `complete`, so the money moved, the
 * activation webhooks are in flight, and the backend refused to terminalize the
 * row — the cancellation did NOT happen. Neither a failure nor a success.
 */
describe('CancelSubscriptionDialog activation-pending 409', () => {
	const pending409 = {
		data: undefined,
		error: {
			detail: "Your payment went through. We're still confirming your subscription.",
			code: 'subscription_activation_pending'
		},
		response: { ok: false, status: 409 } as unknown as Response
	};

	it('explains that the payment landed and the membership was not cancelled', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue(pending409);
		renderDialog();
		await chooseImmediate(user);
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		const status = await screen.findByRole('status');
		expect(status).toHaveTextContent(/your payment went through/i);
		expect(status).toHaveTextContent(/wasn't cancelled/i);
		expect(status).toHaveTextContent(/once it's active/i);
		// The backend's own translated sentence rides along underneath.
		expect(status).toHaveTextContent(/still confirming your subscription/i);
	});

	// Rendering this red would tell someone who was just charged that something
	// broke. It is a status, not an alert, and never the destructive token.
	it('renders it as a non-destructive status rather than an error', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue(pending409);
		renderDialog();
		await chooseImmediate(user);
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		const status = await screen.findByRole('status');
		expect(screen.queryByRole('alert')).toBeNull();
		expect(status.querySelector('.text-destructive')).toBeNull();
		expect(toastErrorMock).not.toHaveBeenCalled();
	});

	// Telling them they're cancelled while Stripe is about to bill them is the
	// other half of the failure mode.
	it('fires no success toast and stays open with nothing to retry', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue(pending409);
		const onOpenChange = vi.fn();
		renderDialog({ onOpenChange });
		await chooseImmediate(user);
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		await screen.findByRole('status');
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
		// A second attempt could only hit the same 409 until the webhook lands.
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
		expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
		expect(cancelMock).toHaveBeenCalledTimes(1);
	});

	// No response body to seed, so the caches are re-read from the server: the row
	// is being rewritten by the activation webhooks right now.
	it('invalidates the member-facing subscription caches', async () => {
		const user = userEvent.setup();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const invalidate = vi.spyOn(client, 'invalidateQueries');
		cancelMock.mockResolvedValue(pending409);
		renderDialog({}, client);
		await chooseImmediate(user);
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		await screen.findByRole('status');
		await waitFor(() => {
			const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
			expect(keys).toContain(JSON.stringify(['me', 'memberships']));
			expect(keys).toContain(JSON.stringify(['me', 'subscriptions']));
			expect(keys).toContain(JSON.stringify(['me', 'org', 'o1', 'subscription']));
		});
	});
});

/**
 * 502: Stripe was unreachable, the cancel was aborted, nothing changed. The
 * backend's own detail ("Payment processing failed…") reads like a charge
 * failed, which is the opposite of what happened.
 */
describe('CancelSubscriptionDialog 502', () => {
	it('promises the membership is untouched and invites a retry', async () => {
		const user = userEvent.setup();
		cancelMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Payment processing failed. Please try again later.' },
			response: { ok: false, status: 502 } as unknown as Response
		});
		renderDialog();
		await user.click(screen.getByRole('button', { name: /cancel membership/i }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(/couldn't reach the payment provider/i);
		expect(alert).toHaveTextContent(/nothing was changed/i);
		expect(alert).not.toHaveTextContent(/payment processing failed/i);
		// Distinct from the generic fallback, which promises nothing about state.
		expect(alert).not.toHaveTextContent(/could not cancel your membership/i);
		// A real failure, so the retry stays available.
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /cancel membership/i })).toBeEnabled()
		);
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});
});
