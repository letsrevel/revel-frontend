import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipCard from './MembershipCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MyMembershipSchema,
	MySubscriptionSchema,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';
import { formatDate } from '$lib/utils/date';

// The card mounts both action dialogs unconditionally, so every SDK function
// they import has to exist on the mocked module or the import itself throws.
const portalMock = vi.hoisted(() => vi.fn());
const plansMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsCreateBillingPortalSession: portalMock,
	organizationListMembershipPlans: plansMock,
	mesubscriptionsCancelSubscription: vi.fn(),
	mesubscriptionsChangePlan: vi.fn(),
	organizationGetOrganization: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const PERIOD_END = '2026-09-01T00:00:00Z';
const GRACE_DEADLINE = '2026-09-08T00:00:00Z';
const PAGE_URL = 'http://localhost/account/memberships';

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 's1',
		plan_id: 'p1',
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
		status: 'active',
		current_period_start: '2026-08-01T00:00:00Z',
		current_period_end: PERIOD_END,
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		grace_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-08-01T00:00:00Z',
		updated_at: '2026-08-01T00:00:00Z',
		plan: {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Monthly',
			description: null,
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			payment_method: 'online',
			sales_status: 'open',
			is_active: true
		},
		...overrides
	};
}

function makeOfflineSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	const sub = makeSub(overrides);
	return { ...sub, plan: { ...sub.plan, payment_method: 'offline' } };
}

function makeMembership(sub: MySubscriptionSchema | null): MyMembershipSchema {
	return {
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
		member_since: '2026-08-01T00:00:00Z',
		status: 'active',
		tier: null,
		subscription: sub
	};
}

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
	return {
		id: 'p2',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Yearly',
		description: null,
		price: '100.00',
		currency: 'EUR',
		period_unit: 'year',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false,
		...overrides
	};
}

describe('MembershipCard', () => {
	let queryClient: QueryClient;
	let originalLocation: Location;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		originalLocation = window.location;
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { href: PAGE_URL } as Location
		});
		plansMock.mockResolvedValue({ data: [makePlan()], error: undefined });
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
	});

	function renderCard(membership: MyMembershipSchema) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: MembershipCard, componentProps: { membership } }
		});
	}

	it('offers all three self-serve actions on an online active subscription', () => {
		renderCard(makeMembership(makeSub()));

		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /change plan/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel membership/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /view org/i })).toBeInTheDocument();
	});

	it('offers no self-serve actions on an offline subscription and says who manages it', () => {
		renderCard(makeMembership(makeOfflineSub()));

		expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
		expect(
			screen.getByText('Managed by Test Org — contact them to make changes.')
		).toBeInTheDocument();
	});

	it('raises a dated past-due alert for an online subscription', () => {
		renderCard(makeMembership(makeSub({ status: 'past_due', grace_deadline: GRACE_DEADLINE })));

		expect(screen.getByRole('alert')).toHaveTextContent(
			`update your payment method by ${formatDate(GRACE_DEADLINE)}`
		);
		// Self-serve members fix this in the portal, not by emailing the organizer.
		expect(screen.queryByText(/reach out to the organizer/i)).toBeNull();
		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
	});

	it('falls back to an undated past-due alert when no grace deadline is known', () => {
		renderCard(makeMembership(makeSub({ status: 'past_due' })));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Payment failed — update your payment method to keep your membership.'
		);
	});

	it('points an offline past-due member at the organizer instead of a portal', () => {
		renderCard(makeMembership(makeOfflineSub({ status: 'past_due' })));

		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByText(/reach out to the organizer/i)).toBeInTheDocument();
	});

	it('leaves only billing management once cancellation is scheduled', () => {
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true })));

		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
		expect(
			screen.getByText('Renewal is off. To keep your membership, contact the organization.')
		).toBeInTheDocument();
	});

	it('sends the member to the Stripe billing portal and back to this page', async () => {
		const user = userEvent.setup();
		portalMock.mockResolvedValue({
			data: { url: 'https://billing.stripe.test/session/abc' },
			error: undefined
		});
		renderCard(makeMembership(makeSub()));

		await user.click(screen.getByRole('button', { name: /manage billing/i }));

		await waitFor(() =>
			expect(portalMock).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_id: 'org-1' },
					body: { return_url: PAGE_URL }
				})
			)
		);
		await waitFor(() =>
			expect(window.location.href).toBe('https://billing.stripe.test/session/abc')
		);
	});

	it('names the queued plan from the org plan catalogue when a switch is pending', async () => {
		renderCard(makeMembership(makeSub({ pending_plan_id: 'p2' })));

		expect(
			await screen.findByText(`Switching to Yearly on ${formatDate(PERIOD_END)}`)
		).toBeInTheDocument();
		await waitFor(() =>
			expect(plansMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'test-org' } })
			)
		);
		// The backend rejects a second change while one is queued.
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
	});

	it('does not fetch the plan catalogue when nothing is queued', async () => {
		renderCard(makeMembership(makeSub()));

		await waitFor(() =>
			expect(screen.getByRole('button', { name: /manage billing/i })).toBeVisible()
		);
		expect(plansMock).not.toHaveBeenCalled();
	});

	it('still shows the plain member-since line when there is no subscription', () => {
		renderCard(makeMembership(null));

		expect(screen.getByText(/member since/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
	});
});
