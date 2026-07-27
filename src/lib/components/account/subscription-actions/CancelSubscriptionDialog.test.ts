import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';
import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';

const cancelMock = vi.hoisted(() => vi.fn());
const orgMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsCancelSubscription: cancelMock,
	organizationGetOrganization: orgMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

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

beforeEach(() => {
	cancelMock.mockReset();
	orgMock.mockReset().mockResolvedValue({
		data: { membership_refund_policy: 'No refunds after 14 days.' },
		error: undefined
	});
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
