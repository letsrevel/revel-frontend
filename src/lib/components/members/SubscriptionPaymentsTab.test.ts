import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionPaymentsTab from './SubscriptionPaymentsTab.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsListOrganizationSubscriptionPayments,
	organizationadminsubscriptionsListOrganizationPlans,
	organizationadminsubscriptionsRefundPayment
} from '$lib/api/generated/sdk.gen';
import type {
	OrganizationAdminDetailSchema,
	OrganizationMembershipPaymentSchema,
	PlanSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsListOrganizationSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsListOrganizationPlans: vi.fn(),
	organizationadminsubscriptionsRefundPayment: vi.fn()
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { error: toastErrorMock, success: toastSuccessMock }
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
		// The dominant ledger row: staff-recorded, so no Stripe fee was taken and
		// the whole fee breakdown stays suppressed unless a test opts in.
		payment_method: 'offline',
		platform_fee: '0.00',
		platform_fee_net: null,
		platform_fee_vat: null,
		platform_fee_vat_rate: null,
		platform_fee_reverse_charge: false,
		...overrides
	} as OrganizationMembershipPaymentSchema;
}

/** A Stripe charge that actually paid a fee: 10.00 gross, 1.80 fee (1.50 + 20% VAT). */
function withFee(
	overrides: Partial<OrganizationMembershipPaymentSchema> = {}
): OrganizationMembershipPaymentSchema {
	return makePayment({
		payment_method: 'online',
		amount: '10.00',
		platform_fee: '1.80',
		platform_fee_net: '1.50',
		platform_fee_vat: '0.30',
		platform_fee_vat_rate: '20.00',
		platform_fee_reverse_charge: false,
		...overrides
	});
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

/** The mobile card list, which must carry exactly the same information. */
function cards(): HTMLElement {
	return screen.getByRole('list', { name: 'Membership payments, newest first' });
}

// bits-ui pins pointer-events on <body> while the refund dialog is open, and
// jsdom keeps <body> across tests — reset it or the first user-event click in a
// later test is swallowed.
beforeEach(() => {
	document.body.style.pointerEvents = '';
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

describe('SubscriptionPaymentsTab post-refund net', () => {
	// The backend never reduces the platform fee on a refund, so the refund comes
	// entirely out of the organizer's remainder: 10.00 - 1.80 - 4.00 = 4.20.
	it('deducts a partial refund from the net and leaves the fee line alone', async () => {
		arrange([withFee({ refund_amount: '4.00', status: 'succeeded' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(within(t).getByText('Ada Lovelace')).toBeInTheDocument();

		const refundLine = within(t).getByText('Refunded to member').closest('div');
		expect(within(refundLine as HTMLElement).getByText('-€4.00')).toBeInTheDocument();
		expect(within(t).getByText('-€1.80')).toBeInTheDocument();
		const net = within(t).getByText('Net to you').closest('div');
		expect(within(net as HTMLElement).getByText('€4.20')).toBeInTheDocument();
		// The pre-refund figure must not survive anywhere on the row.
		expect(within(t).queryByText('€8.20')).not.toBeInTheDocument();
	});

	// The organizer refunded the whole gross but Revel kept its fee, so the row
	// really did cost them 1.80. Rendered negative, never clamped.
	it('renders a negative net on a full refund and explains the minus in words', async () => {
		arrange([withFee({ refund_amount: '10.00', status: 'refunded' })]);
		renderTab();

		const t = await screen.findByRole('table');
		const net = within(t).getByText('Net to you').closest('div');
		expect(within(net as HTMLElement).getByText('-€1.80')).toBeInTheDocument();
		expect(within(t).getByText(/platform fee is out of pocket/)).toBeInTheDocument();
	});

	it('states the fee rule affirmatively, but only where a refund exists', async () => {
		arrange([withFee({ refund_amount: '4.00' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(within(t).getByText(/not reduced by refunds/)).toBeInTheDocument();
	});

	it('keeps the rule, the refund line and the negative note off an unrefunded row', async () => {
		arrange([withFee()]);
		renderTab();

		const t = await screen.findByRole('table');
		const net = within(t).getByText('Net to you').closest('div');
		expect(within(net as HTMLElement).getByText('€8.20')).toBeInTheDocument();
		expect(within(t).queryByText(/not reduced by refunds/)).not.toBeInTheDocument();
		expect(within(t).queryByText('Refunded to member')).not.toBeInTheDocument();
		expect(within(t).queryByText(/out of pocket/)).not.toBeInTheDocument();
	});

	// No fee means nothing sits between gross and net: the gross and the refund
	// annotation already say everything, so no net line is invented.
	it('shows no net at all when a refunded row took no platform fee', async () => {
		arrange([makePayment({ refund_amount: '4.00', platform_fee: '0.00' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(within(t).getByText(/4[.,]00.*refunded/)).toBeInTheDocument();
		expect(within(t).queryByText('Net to you')).not.toBeInTheDocument();
		expect(within(t).queryByText('Refunded to member')).not.toBeInTheDocument();
	});

	// The phone view is not allowed to be a lossy summary of the table.
	it('carries the same refund deduction and net on the mobile card', async () => {
		arrange([withFee({ refund_amount: '10.00', status: 'refunded' })]);
		renderTab();

		await screen.findByRole('table');
		const list = cards();
		const refundLine = within(list).getByText('Refunded to member').closest('div');
		expect(within(refundLine as HTMLElement).getByText('-€10.00')).toBeInTheDocument();
		const net = within(list).getByText('Net to you').closest('div');
		expect(within(net as HTMLElement).getByText('-€1.80')).toBeInTheDocument();
		expect(within(list).getByText(/not reduced by refunds/)).toBeInTheDocument();
		expect(within(list).getByText(/platform fee is out of pocket/)).toBeInTheDocument();
	});
});

describe('SubscriptionPaymentsTab refund gating', () => {
	// `POST …/payments/{id}/refund` 400s for ONLINE payments (money that moved
	// through Stripe has to come back through Stripe), so the control must not
	// exist there — a dead button is worse than none.
	it('offers a refund on a succeeded OFFLINE row', async () => {
		arrange([makePayment({ status: 'succeeded', payment_method: 'offline' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(
			within(t).getByRole('button', { name: 'Refund payment from Ada Lovelace' })
		).toBeInTheDocument();
	});

	it('offers no refund on a succeeded ONLINE row', async () => {
		arrange([makePayment({ status: 'succeeded', payment_method: 'online' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(within(t).getByText('Ada Lovelace')).toBeInTheDocument();
		expect(within(t).queryByRole('button', { name: /Refund/ })).not.toBeInTheDocument();
	});

	it('offers no refund on an already-refunded OFFLINE row', async () => {
		arrange([makePayment({ status: 'refunded', payment_method: 'offline' })]);
		renderTab();

		const t = await screen.findByRole('table');
		expect(within(t).getByText('Ada Lovelace')).toBeInTheDocument();
		expect(within(t).queryByRole('button', { name: /Refund/ })).not.toBeInTheDocument();
	});

	it('scopes the control to the refundable row when the page mixes both', async () => {
		arrange([
			makePayment({ id: 'pay-1', payment_method: 'online', user_display_name: 'Grace Hopper' }),
			makePayment({ id: 'pay-2', payment_method: 'offline' })
		]);
		renderTab();

		const t = await screen.findByRole('table');
		const rows = within(t).getAllByRole('row').slice(1); // drop the header row
		expect(within(rows[0]).queryByRole('button', { name: /Refund/ })).not.toBeInTheDocument();
		expect(
			within(rows[1]).getByRole('button', { name: 'Refund payment from Ada Lovelace' })
		).toBeInTheDocument();
	});

	it('points staff at Stripe for the rows that carry no control', async () => {
		arrange([makePayment({ status: 'succeeded', payment_method: 'online' })]);
		renderTab();

		await screen.findByRole('table');
		expect(await screen.findByText(/Stripe Dashboard/i)).toBeInTheDocument();
	});

	it('keeps that note away from a purely offline page', async () => {
		arrange([makePayment({ status: 'succeeded', payment_method: 'offline' })]);
		renderTab();

		await screen.findByRole('table');
		expect(screen.queryByText(/Stripe Dashboard/i)).not.toBeInTheDocument();
	});

	it('offers the refund on the mobile card too', async () => {
		arrange([makePayment({ status: 'succeeded', payment_method: 'offline' })]);
		renderTab();

		await screen.findByRole('table');
		expect(
			within(cards()).getByRole('button', { name: 'Refund payment from Ada Lovelace' })
		).toBeInTheDocument();
	});
});

describe('SubscriptionPaymentsTab refund flow', () => {
	function arrangeRefund(ok = true) {
		vi.mocked(organizationadminsubscriptionsRefundPayment).mockResolvedValue({
			data: ok ? makePayment({ status: 'refunded', refund_amount: '10.00' }) : undefined,
			error: ok
				? undefined
				: { detail: 'ONLINE payments must be refunded from the Stripe Dashboard' },
			response: { ok, status: ok ? 200 : 400 } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsRefundPayment>>);
	}

	async function openDialogAndSubmit() {
		const user = userEvent.setup();
		const t = await screen.findByRole('table');
		await user.click(within(t).getByRole('button', { name: 'Refund payment from Ada Lovelace' }));
		const dialog = await screen.findByRole('dialog');
		await user.type(within(dialog).getByLabelText('Notes'), 'cash back');
		await user.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
	}

	it('sends the payment id as a path param and the notes as the body', async () => {
		arrange([makePayment({ id: 'pay-1', payment_method: 'offline' })]);
		arrangeRefund();
		renderTab();
		await openDialogAndSubmit();

		await waitFor(() =>
			expect(organizationadminsubscriptionsRefundPayment).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'test-org', payment_id: 'pay-1' },
					body: { notes: 'cash back' }
				})
			)
		);
	});

	// The refetch can drop the row out of a status-filtered page, so a silent
	// close would read as "nothing happened".
	it('refetches the ledger and confirms the refund', async () => {
		arrange([makePayment({ id: 'pay-1', payment_method: 'offline' })]);
		arrangeRefund();
		renderTab();
		await openDialogAndSubmit();

		await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
		// One call for the initial load, one for the post-refund invalidation.
		await waitFor(() =>
			expect(
				vi.mocked(organizationadminsubscriptionsListOrganizationSubscriptionPayments).mock.calls
					.length
			).toBeGreaterThan(1)
		);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('surfaces the backend refusal instead of closing quietly', async () => {
		arrange([makePayment({ id: 'pay-1', payment_method: 'offline' })]);
		arrangeRefund(false);
		renderTab();
		await openDialogAndSubmit();

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				expect.stringContaining('must be refunded from the Stripe Dashboard')
			)
		);
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});
});
