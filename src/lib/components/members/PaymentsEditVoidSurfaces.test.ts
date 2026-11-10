import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionPaymentsTab from './SubscriptionPaymentsTab.svelte';
import SubscriptionDrawer from './SubscriptionDrawer.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsGetSubscription,
	organizationadminsubscriptionsListOrganizationPlans,
	organizationadminsubscriptionsListOrganizationSubscriptionPayments,
	organizationadminsubscriptionsListSubscriptionPayments
} from '$lib/api/generated/sdk.gen';
import type {
	MembershipPaymentSchema,
	OrganizationAdminDetailSchema,
	OrganizationMembershipPaymentSchema,
	SubscriptionSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsGetSubscription: vi.fn(),
	organizationadminsubscriptionsListSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsListOrganizationSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsListOrganizationPlans: vi.fn(),
	organizationadminsubscriptionsRefundPayment: vi.fn(),
	organizationadminsubscriptionsRecordPayment: vi.fn(),
	organizationadminsubscriptionsCancelSubscription: vi.fn(),
	organizationadminsubscriptionsPauseSubscription: vi.fn(),
	organizationadminsubscriptionsResumeSubscription: vi.fn(),
	organizationadminsubscriptionsReviveSubscription: vi.fn(),
	organizationadminsubscriptionsUncancelSubscription: vi.fn(),
	organizationadminsubscriptionsUpdateSubscriptionPayment: vi.fn(),
	organizationadminsubscriptionsVoidSubscriptionPayment: vi.fn()
}));

vi.mock('svelte-sonner', () => ({
	toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() }
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const organization = {
	id: 'org-1',
	slug: 'test-org',
	name: 'Test Org'
} as unknown as OrganizationAdminDetailSchema;

const base = {
	subscription_id: 'sub-1',
	amount: '10.00',
	currency: 'EUR',
	notes: '',
	period_start: '2026-08-01T00:00:00Z',
	period_end: '2026-09-01T00:00:00Z',
	occurred_at: '2026-08-03T00:00:00Z',
	created_at: '2026-08-05T00:00:00Z',
	recorded_by_id: null,
	recorded_by_name: null,
	stripe_dashboard_url: null,
	platform_fee: '0.00'
};

function ledgerRow(
	overrides: Partial<OrganizationMembershipPaymentSchema> = {}
): OrganizationMembershipPaymentSchema {
	return {
		...base,
		id: 'pay-1',
		status: 'succeeded',
		can_edit: true,
		can_void: true,
		user_id: 'user-1',
		user_email: 'ada@example.com',
		user_display_name: 'Ada Lovelace',
		plan_id: 'plan-1',
		plan_name: 'Monthly',
		payment_method: 'offline',
		...overrides
	} as OrganizationMembershipPaymentSchema;
}

function drawerRow(overrides: Partial<MembershipPaymentSchema> = {}): MembershipPaymentSchema {
	return {
		...base,
		id: 'pay-1',
		status: 'succeeded',
		can_edit: true,
		can_void: true,
		...overrides
	} as MembershipPaymentSchema;
}

const ok = (data: unknown) => ({
	data,
	error: undefined,
	response: { ok: true } as unknown as Response
});

function newClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('org-wide payments tab', () => {
	const ledger = vi.mocked(organizationadminsubscriptionsListOrganizationSubscriptionPayments);

	function arrange(rows: OrganizationMembershipPaymentSchema[]) {
		vi.mocked(organizationadminsubscriptionsListOrganizationPlans).mockResolvedValue(
			ok([]) as never
		);
		ledger.mockResolvedValue(
			ok({ results: rows, count: rows.length, next: null, previous: null }) as never
		);
		render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SubscriptionPaymentsTab,
				componentProps: { organization }
			}
		});
	}

	it('offers Edit and Void in both the table row and the mobile card', async () => {
		arrange([ledgerRow()]);
		const table = await screen.findByRole('table');
		expect(within(table).getByRole('button', { name: /^Edit the payment of/ })).toBeInTheDocument();
		expect(within(table).getByRole('button', { name: /^Void the payment of/ })).toBeInTheDocument();
		const cards = screen.getByRole('list', { name: 'Membership payments, newest first' });
		expect(within(cards).getByRole('button', { name: /^Edit the payment of/ })).toBeInTheDocument();
		expect(within(cards).getByRole('button', { name: /^Void the payment of/ })).toBeInTheDocument();
	});

	it('shows no Edit or Void on a row the backend marks ineligible', async () => {
		arrange([ledgerRow({ can_edit: false, can_void: false })]);
		await screen.findByRole('table');
		expect(screen.queryByRole('button', { name: /^Edit the payment of/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /^Void the payment of/ })).toBeNull();
	});

	it('opens the edit dialog from a row', async () => {
		arrange([ledgerRow()]);
		const table = await screen.findByRole('table');
		await userEvent.click(within(table).getByRole('button', { name: /^Edit the payment of/ }));
		expect(await screen.findByRole('dialog', { name: 'Edit payment' })).toBeInTheDocument();
	});

	it('opens the void confirm from a card', async () => {
		arrange([ledgerRow()]);
		await screen.findByRole('table');
		const cards = screen.getByRole('list', { name: 'Membership payments, newest first' });
		await userEvent.click(within(cards).getByRole('button', { name: /^Void the payment of/ }));
		expect(await screen.findByRole('dialog', { name: 'Void this payment?' })).toBeInTheDocument();
	});

	it('hides voided rows by default and asks for them with the toggle', async () => {
		arrange([ledgerRow()]);
		await screen.findByRole('table');
		expect(ledger.mock.calls[0][0]?.query?.include_voided).toBeUndefined();

		await userEvent.click(screen.getByLabelText('Show voided payments'));
		await waitFor(() =>
			expect(ledger).toHaveBeenLastCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ include_voided: true }) })
			)
		);
	});

	it('renders a voided row with its badge and no actions', async () => {
		arrange([ledgerRow({ status: 'voided', can_edit: false, can_void: false })]);
		const table = await screen.findByRole('table');
		expect(within(table).getByText('Voided')).toBeInTheDocument();
		expect(within(table).queryByRole('button')).toBeNull();
	});
});

describe('subscription drawer payments', () => {
	const list = vi.mocked(organizationadminsubscriptionsListSubscriptionPayments);

	function arrange(rows: MembershipPaymentSchema[]) {
		vi.mocked(organizationadminsubscriptionsGetSubscription).mockResolvedValue(
			ok({
				id: 'sub-1',
				status: 'active',
				user_display_name: 'Ada Lovelace',
				user_email: 'ada@example.com',
				current_period_start: '2026-08-01T00:00:00Z',
				current_period_end: '2026-09-01T00:00:00Z',
				plan: {
					id: 'plan-1',
					name: 'Monthly',
					price: '10.00',
					currency: 'EUR',
					period_unit: 'month',
					period_count: 1,
					payment_method: 'offline'
				}
			} as unknown as SubscriptionSchema) as never
		);
		list.mockResolvedValue(ok({ results: rows, count: rows.length }) as never);
		render(QueryClientTestWrapper, {
			props: {
				client: newClient(),
				component: SubscriptionDrawer,
				componentProps: { organization, subId: 'sub-1', open: true, onClose: vi.fn() }
			}
		});
	}

	it('offers Edit and Void on an eligible row and opens the dialogs', async () => {
		arrange([drawerRow()]);
		await userEvent.click(await screen.findByRole('button', { name: /^Edit the payment of/ }));
		expect(await screen.findByRole('dialog', { name: 'Edit payment' })).toBeInTheDocument();
	});

	it('hides Edit when can_edit is false and Void when can_void is false', async () => {
		arrange([drawerRow({ can_edit: false, can_void: false })]);
		await screen.findByRole('table');
		expect(screen.queryByRole('button', { name: /^Edit the payment of/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /^Void the payment of/ })).toBeNull();
	});

	it('keeps Void away from a row that is editable but not voidable', async () => {
		arrange([drawerRow({ can_edit: true, can_void: false })]);
		expect(await screen.findByRole('button', { name: /^Edit the payment of/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^Void the payment of/ })).toBeNull();
	});

	it('adds include_voided: true to the list call when "Show voided" is on', async () => {
		arrange([drawerRow()]);
		await screen.findByRole('table');
		expect(list.mock.calls[0][0]?.query?.include_voided).toBeUndefined();

		await userEvent.click(screen.getByLabelText('Show voided payments'));
		await waitFor(() =>
			expect(list).toHaveBeenLastCalledWith(
				expect.objectContaining({ query: { include_voided: true } })
			)
		);
	});

	it('renders a voided row with its badge and no actions', async () => {
		arrange([drawerRow({ status: 'voided', can_edit: false, can_void: false })]);
		const table = await screen.findByRole('table');
		expect(within(table).getByText('Voided')).toBeInTheDocument();
		expect(within(table).queryByRole('button')).toBeNull();
	});
});
