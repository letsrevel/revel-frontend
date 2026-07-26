import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
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

function renderDialog(props: Record<string, unknown> = {}) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: CancelSubscriptionDialog,
			props: { open: true, onOpenChange: vi.fn(), sub, ...props }
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

	it('renders the refund policy fetched from the public org endpoint', async () => {
		renderDialog();
		expect(await screen.findByText(/no refunds after 14 days/i)).toBeInTheDocument();
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
