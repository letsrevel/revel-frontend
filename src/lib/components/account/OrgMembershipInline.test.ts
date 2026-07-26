import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import OrgMembershipInline from './OrgMembershipInline.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { mesubscriptionsGetMySubscription } from '$lib/api/generated/sdk.gen';
import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
import { formatDate } from '$lib/utils/date';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsGetMySubscription: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const PERIOD_END = '2026-09-01T00:00:00Z';

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
	return {
		id: 'p2',
		tier_id: 't1',
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

function mockSub(sub: MySubscriptionSchema | null) {
	vi.mocked(mesubscriptionsGetMySubscription).mockResolvedValue({
		data: sub ?? undefined,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as ReturnType<typeof mesubscriptionsGetMySubscription>);
}

describe('OrgMembershipInline', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	function renderInline(plans: PublicPlanSchema[] = []) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: OrgMembershipInline,
				props: { orgId: 'org-1', orgName: 'Test Org', plans }
			}
		});
	}

	it('shows the pending switch line and the manage link for an online subscription', async () => {
		mockSub(makeSub({ pending_plan_id: 'p2' }));
		renderInline([makePlan()]);

		await waitFor(() => {
			expect(
				screen.getByText(`Switching to Yearly on ${formatDate(PERIOD_END)}`)
			).toBeInTheDocument();
		});
		// Exact name, not a substring: the trailing arrow is decorative
		// (aria-hidden) and must stay out of the link's accessible name.
		expect(screen.getByRole('link', { name: 'Manage in your account' })).toHaveAttribute(
			'href',
			'/account/memberships'
		);
		// Online subscriptions are self-serve — the staff-managed footer must not show.
		expect(screen.queryByText(/managed by/i)).toBeNull();
	});

	it('falls back to a generic plan name when the pending plan is not in `plans`', async () => {
		mockSub(makeSub({ pending_plan_id: 'unknown-plan' }));
		renderInline([makePlan()]);

		await waitFor(() => {
			expect(
				screen.getByText(`Switching to another plan on ${formatDate(PERIOD_END)}`)
			).toBeInTheDocument();
		});
	});

	it('omits the pending switch line when there is no current period end', async () => {
		mockSub(makeSub({ pending_plan_id: 'p2', current_period_end: null }));
		renderInline([makePlan()]);

		await waitFor(() => {
			expect(screen.getByRole('link', { name: /manage in your account/i })).toBeInTheDocument();
		});
		expect(screen.queryByText(/switching to/i)).toBeNull();
	});

	it('shows the staff-managed footer and the manage link for an offline subscription', async () => {
		const sub = makeSub();
		sub.plan.payment_method = 'offline';
		mockSub(sub);
		renderInline();

		await waitFor(() => {
			expect(screen.getByText('Managed by Test Org staff')).toBeInTheDocument();
		});
		expect(screen.getByRole('link', { name: /manage in your account/i })).toBeInTheDocument();
		expect(screen.queryByText(/switching to/i)).toBeNull();
	});

	it('renders nothing when the member has no subscription', async () => {
		mockSub(null);
		const { container } = renderInline();

		await waitFor(() => {
			expect(vi.mocked(mesubscriptionsGetMySubscription)).toHaveBeenCalled();
		});
		expect(container.textContent?.trim()).toBe('');
	});
});
