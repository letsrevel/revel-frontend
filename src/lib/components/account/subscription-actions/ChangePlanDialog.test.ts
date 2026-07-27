import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { formatDate } from '$lib/utils/date';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';
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
	},
	{
		id: 'p7',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Plus',
		price: '20.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false
	},
	{
		id: 'p8',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Both blocked',
		price: '18.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'paused',
		sold_out: true
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

function renderDialog(props: Record<string, unknown> = {}, client?: QueryClient) {
	return render(QueryClientTestWrapper, {
		props: {
			client: client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: ChangePlanDialog,
			componentProps: { open: true, onOpenChange: vi.fn(), sub, ...props }
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
		expect(screen.getByRole('radio', { name: /Plus/ })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: /Both blocked/ })).toBeInTheDocument();

		// p1 is the current plan, p5 is another currency, p6 is offline-managed.
		expect(screen.queryByRole('radio', { name: /Monthly/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('radio', { name: /USD plan/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('radio', { name: /Offline plan/ })).not.toBeInTheDocument();
		expect(screen.getAllByRole('radio')).toHaveLength(5);
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

	it('prefers the sold-out reason when a plan is both sold out and paused', async () => {
		renderDialog();

		const both = await screen.findByRole('radio', { name: /Both blocked/ });
		expect(both).toBeDisabled();
		const helper = document.getElementById(both.getAttribute('aria-describedby') as string);
		expect(helper).toHaveTextContent('All spots are taken');
		expect(helper).not.toHaveTextContent('temporarily closed sign-ups');
	});

	it('explains an upgrade and reports it as effective immediately', async () => {
		const user = userEvent.setup();
		changeMock.mockResolvedValue({ data: { ...(sub as object) }, error: undefined });
		renderDialog();

		// €20/month against the current €10/month → an upgrade.
		await user.click(await screen.findByRole('radio', { name: /Plus/ }));

		expect(
			await screen.findByText(
				"You'll be charged the difference now (prorated) and switch immediately."
			)
		).toBeInTheDocument();
		expect(screen.queryByText(/next renewal/i)).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /switch plan/i }));
		await waitFor(() =>
			expect(changeMock).toHaveBeenCalledWith(
				expect.objectContaining({ body: { plan_id: 'p7' }, path: { org_id: 'o1' } })
			)
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plan switched.'));
	});

	it('announces the direction note from a pre-mounted polite live region', async () => {
		const user = userEvent.setup();
		renderDialog();

		const dialog = await screen.findByRole('dialog');
		await screen.findByRole('radio', { name: /Yearly/ });

		// The region must exist *before* the first status lands, otherwise screen
		// readers never announce it (WCAG 2.1 AA §4.1.3).
		const region = dialog.querySelector('[aria-live="polite"]');
		expect(region).not.toBeNull();
		expect(region).toBeEmptyDOMElement();

		await user.click(screen.getByRole('radio', { name: /Yearly/ }));
		await waitFor(() => expect(region).toHaveTextContent('Takes effect at your next renewal'));

		// The same node must survive a change of selection — a remounted region
		// is a new region, and its content would not be announced.
		await user.click(screen.getByRole('radio', { name: /Plus/ }));
		await waitFor(() => expect(region).toHaveTextContent('charged the difference now'));
		expect(dialog.querySelector('[aria-live="polite"]')).toBe(region);
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

	// #693, same bug class as the cancel path: a downgrade is mirrored to a Stripe
	// Subscription Schedule whose webhooks land after the 200, so the response body
	// — the only snapshot that certainly carries the new `pending_plan_id` — is what
	// the caches are seeded with.
	it('seeds the truthful response body into the member-facing caches', async () => {
		const user = userEvent.setup();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const stale = {
			...(sub as object),
			id: 'sub-1',
			pending_plan_id: null
		} as MySubscriptionSchema;
		const truthful: MySubscriptionSchema = { ...stale, pending_plan_id: 'p2' };
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
		changeMock.mockResolvedValue({ data: truthful, error: undefined });

		renderDialog({}, client);
		await user.click(await screen.findByRole('radio', { name: /Yearly/ }));
		await user.click(screen.getByRole('button', { name: /switch plan/i }));

		await waitFor(() => {
			expect(
				client.getQueryData<MyMembershipSchema[]>(['me', 'memberships'])?.[0].subscription
					?.pending_plan_id
			).toBe('p2');
		});
		expect(
			client.getQueryData<MySubscriptionSchema[]>(['me', 'subscriptions'])?.[0].pending_plan_id
		).toBe('p2');
		expect(
			client.getQueryData<MySubscriptionSchema>(['me', 'org', 'o1', 'subscription'])
				?.pending_plan_id
		).toBe('p2');
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
