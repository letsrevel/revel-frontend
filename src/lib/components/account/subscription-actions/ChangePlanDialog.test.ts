import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { formatDate } from '$lib/utils/date';
import ChangePlanDialog from './ChangePlanDialog.svelte';

const plansMock = vi.hoisted(() => vi.fn());
const changeMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationListMembershipPlans: plansMock,
	mesubscriptionsChangePlan: changeMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PLANS = [
	{
		id: 'p1',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Monthly',
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false
	},
	{
		id: 'p2',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Yearly',
		price: '96.00',
		currency: 'EUR',
		period_unit: 'year',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false
	},
	{
		id: 'p3',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Premium',
		price: '20.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: true
	},
	{
		id: 'p4',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Paused plan',
		price: '15.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'paused',
		sold_out: false
	},
	{
		id: 'p5',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'USD plan',
		price: '12.00',
		currency: 'USD',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false
	},
	{
		id: 'p6',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Offline plan',
		price: '5.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'offline',
		sales_status: 'open',
		sold_out: false
	}
];

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
			component: ChangePlanDialog,
			props: { open: true, onOpenChange: vi.fn(), sub, ...props }
		}
	});
}

beforeEach(() => {
	vi.mocked(toast.success).mockReset();
	changeMock.mockReset();
	plansMock.mockReset().mockResolvedValue({ data: PLANS, error: undefined });
});

describe('ChangePlanDialog', () => {
	it('lists only same-currency ONLINE plans other than the current one', async () => {
		renderDialog();

		expect(await screen.findByRole('radio', { name: /Yearly/ })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: /Premium/ })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: /Paused plan/ })).toBeInTheDocument();

		// p1 is the current plan, p5 is another currency, p6 is offline-managed.
		expect(screen.queryByRole('radio', { name: /Monthly/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('radio', { name: /USD plan/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('radio', { name: /Offline plan/ })).not.toBeInTheDocument();
		expect(screen.getAllByRole('radio')).toHaveLength(3);
	});

	it('disables sold-out and paused options with their helper text', async () => {
		renderDialog();

		const soldOut = await screen.findByRole('radio', { name: /Premium/ });
		expect(soldOut).toBeDisabled();
		const soldOutHelpId = soldOut.getAttribute('aria-describedby');
		expect(soldOutHelpId).toBeTruthy();
		expect(document.getElementById(soldOutHelpId as string)).toHaveTextContent(
			'All spots are taken'
		);

		const paused = screen.getByRole('radio', { name: /Paused plan/ });
		expect(paused).toBeDisabled();
		const pausedHelpId = paused.getAttribute('aria-describedby');
		expect(pausedHelpId).toBeTruthy();
		expect(document.getElementById(pausedHelpId as string)).toHaveTextContent(
			'temporarily closed sign-ups'
		);

		// The one selectable candidate stays enabled and undescribed.
		const yearly = screen.getByRole('radio', { name: /Yearly/ });
		expect(yearly).toBeEnabled();
		expect(yearly).not.toHaveAttribute('aria-describedby');
	});

	it('explains a cross-cadence downgrade correctly', async () => {
		const user = userEvent.setup();
		renderDialog();

		// €96/year = €8/month against the current €10/month → a downgrade.
		await user.click(await screen.findByRole('radio', { name: /Yearly/ }));

		expect(
			await screen.findByText(
				`Takes effect at your next renewal on ${formatDate('2026-08-01T00:00:00Z')}.`
			)
		).toBeInTheDocument();
		expect(screen.queryByText(/charged the difference now/i)).not.toBeInTheDocument();
	});

	it('submits the selected plan id and reports a scheduled downgrade', async () => {
		const user = userEvent.setup();
		changeMock.mockResolvedValue({
			data: { ...(sub as object), current_period_end: '2026-09-15T00:00:00Z' },
			error: undefined
		});
		const onOpenChange = vi.fn();
		renderDialog({ onOpenChange });

		await user.click(await screen.findByRole('radio', { name: /Yearly/ }));
		await user.click(screen.getByRole('button', { name: /switch plan/i }));

		await waitFor(() =>
			expect(changeMock).toHaveBeenCalledWith(
				expect.objectContaining({ body: { plan_id: 'p2' }, path: { org_id: 'o1' } })
			)
		);
		// The date comes from the response, not from the stale local subscription.
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(
				`Switching to Yearly on ${formatDate('2026-09-15T00:00:00Z')}.`
			)
		);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it('shows the empty state when no candidates exist', async () => {
		plansMock.mockResolvedValue({
			data: PLANS.filter((p) => ['p1', 'p5', 'p6'].includes(p.id)),
			error: undefined
		});
		renderDialog();

		expect(
			await screen.findByText('There are no other plans you can switch to right now.')
		).toBeInTheDocument();
		expect(screen.queryAllByRole('radio')).toHaveLength(0);
		expect(screen.getByRole('button', { name: /switch plan/i })).toBeDisabled();
	});

	it('surfaces a backend 400 detail inline', async () => {
		const user = userEvent.setup();
		changeMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'A plan change is already pending for this subscription.' }
		});
		renderDialog();

		await user.click(await screen.findByRole('radio', { name: /Yearly/ }));
		await user.click(screen.getByRole('button', { name: /switch plan/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'A plan change is already pending for this subscription.'
		);
		expect(toast.success).not.toHaveBeenCalled();
	});
});
