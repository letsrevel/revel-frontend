import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipSection from './MembershipSection.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { mesubscriptionsGetMySubscription } from '$lib/api/generated/sdk.gen';
import type {
	MySubscriptionSchema,
	OrganizationRetrieveSchema,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

// Only the membership lookup is stubbed; the rest of the generated client stays
// real so the dialogs mounted alongside the grid keep their own imports.
vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	mesubscriptionsGetMySubscription: vi.fn()
}));

/**
 * `null` is the "never subscribed, or only terminal history" answer — the
 * endpoint 404s, and the query maps that to `null`.
 */
function mockSub(sub: MySubscriptionSchema | null) {
	vi.mocked(mesubscriptionsGetMySubscription).mockResolvedValue({
		data: sub ?? undefined,
		error: sub ? undefined : { detail: 'Not found' },
		response: { ok: !!sub } as unknown as Response
	} as unknown as ReturnType<typeof mesubscriptionsGetMySubscription>);
}

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'p-gold-monthly',
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		status: 'active',
		current_period_start: '2026-07-01T00:00:00Z',
		current_period_end: '2026-08-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		plan: {
			id: 'p-gold-monthly',
			tier_id: 't-gold',
			tier_name: 'Gold',
			name: 'Gold monthly',
			description: null,
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			payment_method: 'online',
			sales_status: 'open'
		},
		...overrides
	};
}

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
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
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false,
		...overrides
	};
}

function makeOrg(overrides: Partial<OrganizationRetrieveSchema> = {}): OrganizationRetrieveSchema {
	return {
		id: 'org-1',
		slug: 'acme',
		name: 'Acme',
		membership_refund_policy: null,
		...overrides
	} as OrganizationRetrieveSchema;
}

describe('MembershipSection', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		mockSub(null);
	});

	function renderSection(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: MembershipSection,
				componentProps: {
					organization: makeOrg(),
					plans: [],
					isAuthenticated: true,
					...props
				}
			}
		});
	}

	// Most organizations sell nothing — the section must not leave an empty
	// "Membership" heading behind on their page.
	it('renders nothing when the organization has no plans', () => {
		renderSection();
		expect(screen.queryByRole('heading', { name: 'Membership' })).toBeNull();
		expect(document.querySelector('#membership')).toBeNull();
	});

	it('groups plans by tier, tiers alphabetically and plans cheapest first', () => {
		renderSection({
			plans: [
				makePlan({
					id: 'p-gold-annual',
					tier_id: 't-gold',
					tier_name: 'Gold',
					name: 'Annual',
					price: '100.00'
				}),
				makePlan({
					id: 'p-basic',
					tier_id: 't-basic',
					tier_name: 'Basic',
					name: 'Basic monthly',
					price: '5.00'
				}),
				makePlan({
					id: 'p-gold-monthly',
					tier_id: 't-gold',
					tier_name: 'Gold',
					name: 'Gold monthly',
					price: '10.00'
				})
			]
		});

		const tierHeadings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
		expect(tierHeadings).toEqual(['Basic', 'Gold']);

		const planHeadings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
		expect(planHeadings).toEqual(['Basic monthly', 'Gold monthly', 'Annual']);
	});

	// The grid is one query away from the truth `OrgMembershipInline` already
	// shows on the same page; before #803 it never asked, and offered a paying
	// member a concrete new charge the backend can only refuse with a 400.
	describe('for a member who already subscribes here', () => {
		const gridPlans = [
			makePlan({
				id: 'p-gold-monthly',
				tier_id: 't-gold',
				tier_name: 'Gold',
				name: 'Gold monthly'
			}),
			makePlan({
				id: 'p-gold-annual',
				tier_id: 't-gold',
				tier_name: 'Gold',
				name: 'Annual',
				price: '100.00'
			})
		];

		it('withdraws Subscribe from every plan and marks the one they are on', async () => {
			mockSub(makeSub({ plan_id: 'p-gold-monthly' }));
			renderSection({ plans: gridPlans });

			await waitFor(() => {
				expect(screen.getByText('Your plan')).toBeInTheDocument();
			});
			expect(screen.queryByRole('button', { name: /^subscribe$/i })).toBeNull();
			expect(screen.getByText(/already have a subscription/i)).toBeInTheDocument();
			// The plans themselves stay on the page — they are still the org's offer.
			expect(screen.getByRole('heading', { name: 'Annual' })).toBeInTheDocument();
		});

		// Cancelled and expired rows are excluded by the endpoint, so a member
		// whose membership ended looks exactly like a newcomer and can rejoin.
		it('keeps Subscribe for a member whose subscription has ended', async () => {
			mockSub(null);
			renderSection({ plans: gridPlans });

			// Enabled, not merely present: the buttons are held disabled until the
			// membership lookup answers, so presence alone would pass while loading.
			await waitFor(() => {
				const ctas = screen.getAllByRole('button', { name: /^subscribe$/i });
				expect(ctas).toHaveLength(2);
				expect(ctas[0]).toBeEnabled();
				expect(ctas[1]).toBeEnabled();
			});
			expect(screen.queryByText('Your plan')).toBeNull();
		});
	});

	it('discloses the refund policy only when the organization has one', () => {
		const { unmount } = renderSection({ plans: [makePlan()] });
		expect(screen.queryByText('Refund policy')).toBeNull();
		unmount();

		renderSection({
			plans: [makePlan()],
			organization: makeOrg({ membership_refund_policy: 'No refunds after 14 days.' })
		});
		expect(screen.getByText('Refund policy')).toBeInTheDocument();
	});
});
