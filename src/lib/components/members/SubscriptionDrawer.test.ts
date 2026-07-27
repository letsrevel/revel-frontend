import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionDrawer from './SubscriptionDrawer.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsGetSubscription,
	organizationadminsubscriptionsListSubscriptionPayments
} from '$lib/api/generated/sdk.gen';
import type {
	OrganizationAdminDetailSchema,
	PaymentSchema2,
	SubscriptionSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsGetSubscription: vi.fn(),
	organizationadminsubscriptionsListSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsRecordPayment: vi.fn(),
	organizationadminsubscriptionsCancelSubscription: vi.fn(),
	organizationadminsubscriptionsPauseSubscription: vi.fn(),
	organizationadminsubscriptionsResumeSubscription: vi.fn(),
	organizationadminsubscriptionsRefundPayment: vi.fn(),
	organizationadminsubscriptionsReviveSubscription: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const organization = {
	id: 'org-1',
	slug: 'test-org',
	name: 'Test Org'
} as unknown as OrganizationAdminDetailSchema;

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
		plan: {
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
			is_active: true
		},
		...overrides
	} as SubscriptionSchema;
}

function makePayment(overrides: Partial<PaymentSchema2> = {}): PaymentSchema2 {
	return {
		id: 'pay-1',
		subscription_id: 'sub-1',
		status: 'succeeded',
		amount: '10.00',
		currency: 'EUR',
		notes: '',
		period_start: '2026-08-01T00:00:00Z',
		period_end: '2026-09-01T00:00:00Z',
		occurred_at: '2026-08-01T00:00:00Z',
		created_at: '2026-08-01T00:00:00Z',
		recorded_by_id: null,
		recorded_by_name: null,
		stripe_dashboard_url: null,
		stripe_invoice_id: null,
		stripe_payment_intent_id: null,
		...overrides
	} as PaymentSchema2;
}

function arrange(sub: SubscriptionSchema, payments: PaymentSchema2[] = []) {
	vi.mocked(organizationadminsubscriptionsGetSubscription).mockResolvedValue({
		data: sub,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsGetSubscription>>);
	vi.mocked(organizationadminsubscriptionsListSubscriptionPayments).mockResolvedValue({
		data: { results: payments, count: payments.length },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<
		ReturnType<typeof organizationadminsubscriptionsListSubscriptionPayments>
	>);
}

function renderDrawer() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});
	return render(QueryClientTestWrapper, {
		props: {
			client,
			component: SubscriptionDrawer,
			componentProps: {
				organization,
				subId: 'sub-1',
				open: true,
				onClose: vi.fn()
			}
		}
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('SubscriptionDrawer Stripe dashboard link', () => {
	it('links the subscription to Stripe when the admin schema carries a URL', async () => {
		arrange(
			makeSub({
				stripe_subscription_id: 'sub_stripe_1',
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/subscriptions/sub_stripe_1',
				plan: { ...makeSub().plan, payment_method: 'online' }
			})
		);
		renderDrawer();

		const link = await screen.findByRole('link', { name: 'Manage on Stripe' });
		expect(link).toHaveAttribute(
			'href',
			'https://dashboard.stripe.com/test/subscriptions/sub_stripe_1'
		);
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	it('renders no Stripe link for an offline subscription', async () => {
		arrange(makeSub());
		renderDrawer();

		// Wait for the drawer body rather than the absent link, so the negative
		// assertion cannot pass merely because nothing has rendered yet. Queried by
		// text because `Button` degrades from <a> to <button> on a nullish href — a
		// role-scoped negative would miss a dead stub.
		await screen.findByText('ada@example.com');
		expect(screen.queryByText('Manage on Stripe')).not.toBeInTheDocument();
	});
});

describe('SubscriptionDrawer refund gating', () => {
	it('hides the per-payment Refund control on an ONLINE plan', async () => {
		arrange(makeSub({ plan: { ...makeSub().plan, payment_method: 'online' } }), [
			makePayment({
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/payments/pi_1'
			})
		]);
		renderDrawer();

		await screen.findByRole('link', { name: 'View on Stripe' });
		expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
	});

	it('keeps the per-payment Refund control on an OFFLINE plan', async () => {
		arrange(makeSub(), [makePayment()]);
		renderDrawer();

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
		});
		expect(screen.queryByText('View on Stripe')).not.toBeInTheDocument();
	});
});
