import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionDrawer from './SubscriptionDrawer.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	OrganizationAdminDetailSchema,
	PlanSchema,
	SubscriptionSchema
} from '$lib/api/generated/types.gen';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));

const sdk = vi.hoisted(() => ({
	getSub: vi.fn(),
	listPayments: vi.fn(),
	listPlans: vi.fn(),
	changePlan: vi.fn()
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsGetSubscription: sdk.getSub,
	organizationadminsubscriptionsListSubscriptionPayments: sdk.listPayments,
	organizationadminsubscriptionsListOrganizationPlans: sdk.listPlans,
	organizationadminsubscriptionsStaffChangeSubscriptionPlan: sdk.changePlan
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = {
	id: 'org-1',
	slug: 'test-org',
	name: 'Test Org'
} as unknown as OrganizationAdminDetailSchema;

function makePlan(overrides: Partial<PlanSchema> = {}): PlanSchema {
	return {
		id: 'plan-1',
		tier_id: 'tier-1',
		tier_name: 'Gold',
		name: 'Monthly',
		description: null,
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'offline',
		sales_status: 'open',
		active_subscription_count: 0,
		is_active: true,
		...overrides
	} as PlanSchema;
}

function makeSub(overrides: Partial<SubscriptionSchema> = {}): SubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
		status: 'active',
		current_period_start: '2026-08-01T00:00:00Z',
		current_period_end: '2026-09-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-08-01T00:00:00Z',
		updated_at: '2026-08-01T00:00:00Z',
		user_id: 'user-1',
		user_display_name: 'Ada Lovelace',
		user_email: 'ada@example.com',
		stripe_subscription_id: null,
		stripe_dashboard_url: null,
		plan: makePlan(),
		...overrides
	} as SubscriptionSchema;
}

const PLANS: PlanSchema[] = [
	makePlan(), // the current plan
	makePlan({ id: 'plan-gold-y', name: 'Gold yearly', price: '100.00' }),
	makePlan({ id: 'plan-silver', tier_id: 'tier-2', tier_name: 'Silver', name: 'Silver monthly' }),
	makePlan({ id: 'plan-archived', name: 'Archived plan', is_active: false }),
	makePlan({ id: 'plan-online', name: 'Online plan', payment_method: 'online' }),
	makePlan({ id: 'plan-free', name: 'Free plan', payment_method: 'free', price: '0.00' }),
	makePlan({ id: 'plan-usd', name: 'Dollar plan', currency: 'USD' })
];

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });

function arrange(sub: SubscriptionSchema) {
	sdk.getSub.mockResolvedValue(ok(sub));
	sdk.listPayments.mockResolvedValue(ok({ results: [], count: 0 }));
	sdk.listPlans.mockResolvedValue(ok(PLANS));
}

function renderDrawer() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
	});
	const invalidate = vi.spyOn(client, 'invalidateQueries');
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SubscriptionDrawer as never,
			componentProps: { organization, subId: 'sub-1', open: true, onClose: vi.fn() }
		}
	});
	return { client, invalidate };
}

async function openChangePlan() {
	await userEvent.click(await screen.findByRole('button', { name: 'Change plan' }));
	return screen.findByRole('dialog', { name: 'Change plan' });
}

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('Change plan action in the subscription drawer', () => {
	it.each(['pending', 'active', 'past_due'] as const)(
		'is offered for an offline %s subscription',
		async (status) => {
			arrange(makeSub({ status }));
			renderDrawer();
			expect(await screen.findByRole('button', { name: 'Change plan' })).toBeEnabled();
		}
	);

	it('is offered for a free plan too', async () => {
		arrange(makeSub({ plan: makePlan({ payment_method: 'free', price: '0.00' }) }));
		renderDrawer();
		expect(await screen.findByRole('button', { name: 'Change plan' })).toBeEnabled();
	});

	it.each(['cancelled', 'expired'] as const)(
		'is hidden for a %s (terminal) subscription',
		async (status) => {
			arrange(makeSub({ status }));
			renderDrawer();
			await screen.findByText('Ada Lovelace');
			expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument();
		}
	);

	it('is disabled for a paused subscription, with the reason linked to it', async () => {
		arrange(makeSub({ status: 'paused' }));
		renderDrawer();
		const button = await screen.findByRole('button', { name: 'Change plan' });
		expect(button).toBeDisabled();
		const hint = screen.getByText('Resume the subscription before changing its plan.');
		expect(button).toHaveAttribute('aria-describedby', hint.id);
	});

	it('shows a note instead of the button for an online plan', async () => {
		arrange(makeSub({ plan: makePlan({ payment_method: 'online' }) }));
		renderDrawer();
		expect(await screen.findByTestId('change-plan-online-note')).toHaveTextContent(
			'Members change an online plan themselves.'
		);
		expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument();
	});
});

describe('Change plan dialog', () => {
	it('lists only same-method, same-currency, active plans other than the current one, grouped by tier', async () => {
		arrange(makeSub());
		renderDrawer();
		const dialog = await openChangePlan();
		const select = await within(dialog).findByLabelText('New plan');
		const options = within(select as HTMLElement).getAllByRole('option');
		const labels = options.map((o) => o.textContent?.split(' — ')[0]);
		expect(labels).toEqual(['—', 'Gold yearly', 'Silver monthly']);
		const groups = within(select as HTMLElement).getAllByRole('group');
		expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Gold', 'Silver']);
	});

	it('tells staff what happens before they confirm', async () => {
		arrange(makeSub());
		renderDrawer();
		const dialog = await openChangePlan();
		await userEvent.selectOptions(await within(dialog).findByLabelText('New plan'), 'plan-silver');
		expect(within(dialog).getByTestId('change-plan-confirm-text')).toHaveTextContent(
			'The member moves to Silver monthly (Silver) now. Their membership tier changes with it. No payment is taken.'
		);
	});

	it('sends the plan id, toasts and invalidates the subscription, members, register and access keys', async () => {
		arrange(makeSub());
		sdk.changePlan.mockResolvedValue(
			ok(makeSub({ plan: PLANS.find((p) => p.id === 'plan-silver'), plan_id: 'plan-silver' }))
		);
		const { invalidate } = renderDrawer();
		const dialog = await openChangePlan();
		const submit = within(dialog).getByRole('button', { name: 'Change plan' });
		expect(submit).toBeDisabled();
		await userEvent.selectOptions(await within(dialog).findByLabelText('New plan'), 'plan-silver');
		await userEvent.click(submit);

		await waitFor(() =>
			expect(sdk.changePlan).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'test-org', sub_id: 'sub-1' },
					body: { plan_id: 'plan-silver' }
				})
			)
		);
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith('Plan changed to Silver monthly.')
		);
		const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
		for (const expected of [
			['organization', 'test-org', 'subscription', 'sub-1'],
			['organization', 'test-org', 'subscription', 'sub-1', 'payments'],
			['organization', 'test-org', 'subscriptions'],
			['organization', 'test-org', 'members'],
			['organization', 'test-org', 'member']
		]) {
			expect(keys).toContain(JSON.stringify(expected));
		}
		// The dialog closes once the change went through.
		await waitFor(() =>
			expect(screen.queryByRole('dialog', { name: 'Change plan' })).not.toBeInTheDocument()
		);
	});

	const refusals: [string, string][] = [
		['tier_follows_subscription', "This member's tier follows their subscription plan"],
		['plan_change_online', 'Members change an online plan themselves.'],
		['subscription_terminal', 'This subscription has ended'],
		['subscription_paused', 'Resume the subscription before changing its plan.'],
		['plan_unchanged', 'The subscription is already on this plan.'],
		['plan_archived', 'This plan is archived'],
		['plan_payment_method_mismatch', 'different payment method'],
		['plan_currency_mismatch', 'different currency']
	];

	it.each(refusals)('shows the message for the 409 code %s and stays open', async (code, text) => {
		arrange(makeSub());
		sdk.changePlan.mockResolvedValue({
			data: undefined,
			error: { detail: 'translated server text', code },
			response: { status: 409 }
		});
		renderDrawer();
		const dialog = await openChangePlan();
		await userEvent.selectOptions(await within(dialog).findByLabelText('New plan'), 'plan-silver');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Change plan' }));
		const alert = await within(dialog).findByRole('alert');
		expect(alert).toHaveTextContent(text);
		expect(alert).not.toHaveTextContent('translated server text');
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('maps the 400 (sold out) and the 404', async () => {
		arrange(makeSub());
		sdk.changePlan.mockResolvedValueOnce({
			data: undefined,
			error: { detail: 'This plan is sold out.' },
			response: { status: 400 }
		});
		renderDrawer();
		const dialog = await openChangePlan();
		await userEvent.selectOptions(await within(dialog).findByLabelText('New plan'), 'plan-silver');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Change plan' }));
		expect(await within(dialog).findByRole('alert')).toHaveTextContent('This plan is sold out.');

		sdk.changePlan.mockResolvedValueOnce({
			data: undefined,
			error: { detail: 'Not found.' },
			response: { status: 404 }
		});
		await userEvent.click(within(dialog).getByRole('button', { name: 'Change plan' }));
		await waitFor(() =>
			expect(within(dialog).getByRole('alert')).toHaveTextContent("wasn't found")
		);
	});

	it('says so when no other plan fits', async () => {
		arrange(makeSub());
		sdk.listPlans.mockResolvedValue(ok([makePlan()]));
		renderDrawer();
		const dialog = await openChangePlan();
		expect(await within(dialog).findByTestId('change-plan-none')).toBeInTheDocument();
	});
});
