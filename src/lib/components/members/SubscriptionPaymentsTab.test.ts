import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionPaymentsTab from './SubscriptionPaymentsTab.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsListOrganizationSubscriptionPayments,
	organizationadminsubscriptionsListOrganizationPlans
} from '$lib/api/generated/sdk.gen';
import type {
	OrganizationAdminDetailSchema,
	OrganizationMembershipPaymentSchema,
	PlanSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsListOrganizationSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsListOrganizationPlans: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const organization = {
	id: 'org-1',
	slug: 'test-org',
	name: 'Test Org'
} as unknown as OrganizationAdminDetailSchema;

function makePayment(
	overrides: Partial<OrganizationMembershipPaymentSchema> = {}
): OrganizationMembershipPaymentSchema {
	return {
		id: 'pay-1',
		subscription_id: 'sub-1',
		status: 'succeeded',
		amount: '10.00',
		currency: 'EUR',
		notes: '',
		period_start: '2026-08-01T00:00:00Z',
		period_end: '2026-09-01T00:00:00Z',
		occurred_at: '2026-08-03T00:00:00Z',
		created_at: '2026-08-05T00:00:00Z',
		recorded_by_id: null,
		recorded_by_name: null,
		refund_amount: null,
		refunded_at: null,
		stripe_refund_id: null,
		stripe_dashboard_url: null,
		stripe_invoice_id: null,
		stripe_payment_intent_id: null,
		user_id: 'user-1',
		user_email: 'ada@example.com',
		user_display_name: 'Ada Lovelace',
		plan_id: 'plan-1',
		plan_name: 'Monthly',
		...overrides
	} as OrganizationMembershipPaymentSchema;
}

const plan = {
	id: 'plan-1',
	tier_id: 'tier-1',
	tier_name: 'Gold',
	name: 'Monthly',
	price: '10.00',
	currency: 'EUR',
	period_unit: 'month',
	period_count: 1,
	payment_method: 'offline',
	sales_status: 'open',
	is_active: true
} as unknown as PlanSchema;

function arrange(payments: OrganizationMembershipPaymentSchema[], count = payments.length) {
	vi.mocked(organizationadminsubscriptionsListOrganizationPlans).mockResolvedValue({
		data: [plan],
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsListOrganizationPlans>>);
	vi.mocked(organizationadminsubscriptionsListOrganizationSubscriptionPayments).mockResolvedValue({
		data: { results: payments, count, next: null, previous: null },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<
		ReturnType<typeof organizationadminsubscriptionsListOrganizationSubscriptionPayments>
	>);
}

function renderTab() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});
	return render(QueryClientTestWrapper, {
		props: { client, component: SubscriptionPaymentsTab, componentProps: { organization } }
	});
}

/** The desktop table — both renderings share text, so scope assertions to one. */
function table(): HTMLElement {
	return screen.getByRole('table');
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('SubscriptionPaymentsTab', () => {
	it('requests the org-wide ledger with the server page size and renders a row', async () => {
		arrange([makePayment()]);
		renderTab();

		await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

		expect(organizationadminsubscriptionsListOrganizationSubscriptionPayments).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { slug: 'test-org' },
				query: expect.objectContaining({ page: 1, page_size: 20 })
			})
		);

		const row = within(table()).getByText('Ada Lovelace').closest('tr');
		expect(row).not.toBeNull();
		expect(within(row as HTMLElement).getByText('ada@example.com')).toBeInTheDocument();
		expect(within(row as HTMLElement).getByText('Monthly')).toBeInTheDocument();
		expect(within(row as HTMLElement).getByText('Succeeded')).toBeInTheDocument();
	});

	// A partial refund deliberately leaves status = 'succeeded', so the status
	// column alone cannot reveal it — the amount must be annotated instead.
	it('annotates a partially refunded payment that still reads as succeeded', async () => {
		arrange([makePayment({ refund_amount: '4.00', refunded_at: '2026-08-10T00:00:00Z' })]);
		renderTab();

		// Gate on row data, never on the status label: "Succeeded" is also an
		// <option> in the status filter, which renders before the query resolves,
		// so waiting on it passes instantly against a still-loading table.
		const t = await screen.findByRole('table');
		expect(within(t).getByText('Ada Lovelace')).toBeInTheDocument();
		expect(within(t).getByText(/4[.,]00.*refunded/)).toBeInTheDocument();
	});

	it('does not annotate a fully refunded payment', async () => {
		arrange([
			makePayment({
				status: 'refunded',
				refund_amount: '10.00',
				refunded_at: '2026-08-10T00:00:00Z'
			})
		]);
		renderTab();

		// Same trap as above ("Refunded" is a filter <option> too). Asserting the
		// row rendered first is what keeps the negative assertion below meaningful
		// — against an empty table it would pass for the wrong reason.
		const t = await screen.findByRole('table');
		expect(within(t).getByText('Ada Lovelace')).toBeInTheDocument();
		// The status chip already says "Refunded"; only the *amount* annotation
		// (which carries a figure) must be absent.
		expect(within(t).queryByText(/10[.,]00\s+refunded/)).not.toBeInTheDocument();
	});

	it('links a payment to its Stripe record when one exists', async () => {
		arrange([
			makePayment({
				stripe_invoice_id: 'in_123',
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/invoices/in_123'
			})
		]);
		renderTab();

		const links = await screen.findAllByRole('link', {
			name: 'View payment on Stripe for Ada Lovelace'
		});
		expect(links[0]).toHaveAttribute('href', 'https://dashboard.stripe.com/test/invoices/in_123');
		expect(links[0]).toHaveAttribute('target', '_blank');
		expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	it('renders no Stripe link when the payment has no dashboard URL', async () => {
		arrange([makePayment()]);
		renderTab();

		await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
		expect(screen.queryByRole('link', { name: /Stripe/ })).not.toBeInTheDocument();
	});

	// The headline use case: paste a Stripe id from a payout line and get back the
	// member it paid for. The term is debounced (300ms) before it reaches the API.
	it('debounces the search box, then forwards the term on page 1', async () => {
		arrange([makePayment()]);
		const user = userEvent.setup();
		renderTab();

		await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

		const input = screen.getByLabelText('Search membership payments');
		await user.type(input, 'in_123');

		// Not forwarded on the keystroke itself.
		expect(
			organizationadminsubscriptionsListOrganizationSubscriptionPayments
		).not.toHaveBeenCalledWith(
			expect.objectContaining({ query: expect.objectContaining({ search: 'in_123' }) })
		);

		await waitFor(() =>
			expect(
				organizationadminsubscriptionsListOrganizationSubscriptionPayments
			).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.objectContaining({ search: 'in_123', page: 1 })
				})
			)
		);
	});

	it('forwards the status filter', async () => {
		arrange([makePayment()]);
		const user = userEvent.setup();
		renderTab();

		await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
		await user.selectOptions(screen.getByLabelText('Filter by payment status'), 'failed');

		await waitFor(() =>
			expect(
				organizationadminsubscriptionsListOrganizationSubscriptionPayments
			).toHaveBeenCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ status: 'failed', page: 1 }) })
			)
		);
	});

	it('forwards the plan filter', async () => {
		arrange([makePayment()]);
		const user = userEvent.setup();
		renderTab();

		await user.selectOptions(await screen.findByLabelText('Filter by plan'), 'plan-1');

		await waitFor(() =>
			expect(
				organizationadminsubscriptionsListOrganizationSubscriptionPayments
			).toHaveBeenCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ plan_id: 'plan-1', page: 1 }) })
			)
		);
	});

	it('shows the unfiltered empty state when the ledger is empty', async () => {
		arrange([]);
		renderTab();

		expect(await screen.findByText('No membership payments recorded yet.')).toBeInTheDocument();
	});

	it('shows a filtered empty state once a filter is applied', async () => {
		arrange([]);
		const user = userEvent.setup();
		renderTab();

		await screen.findByText('No membership payments recorded yet.');
		await user.selectOptions(screen.getByLabelText('Filter by payment status'), 'failed');

		expect(await screen.findByText('No payments match these filters.')).toBeInTheDocument();
	});

	it('surfaces a load failure as an alert with a retry control', async () => {
		vi.mocked(organizationadminsubscriptionsListOrganizationPlans).mockResolvedValue({
			data: [],
			error: undefined,
			response: { ok: true } as unknown as Response
		} as unknown as Awaited<
			ReturnType<typeof organizationadminsubscriptionsListOrganizationPlans>
		>);
		vi.mocked(organizationadminsubscriptionsListOrganizationSubscriptionPayments).mockResolvedValue(
			{
				data: undefined,
				error: { detail: 'boom' },
				response: { ok: false } as unknown as Response
			} as unknown as Awaited<
				ReturnType<typeof organizationadminsubscriptionsListOrganizationSubscriptionPayments>
			>
		);
		renderTab();

		const alert = await screen.findByRole('alert');
		expect(within(alert).getByText("Couldn't load membership payments.")).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
	});

	it('paginates only when the server reports more than one page', async () => {
		arrange([makePayment()], 45);
		const user = userEvent.setup();
		renderTab();

		expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Next' }));

		await waitFor(() =>
			expect(
				organizationadminsubscriptionsListOrganizationSubscriptionPayments
			).toHaveBeenCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ page: 2 }) })
			)
		);
	});

	it('gives the ledger table an accessible name', async () => {
		arrange([makePayment()]);
		renderTab();

		await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));
		expect(
			screen.getByRole('table', { name: 'Membership payments, newest first' })
		).toBeInTheDocument();
	});
});
