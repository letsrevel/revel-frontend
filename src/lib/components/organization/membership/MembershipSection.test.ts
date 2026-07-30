import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipSection from './MembershipSection.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	memembershipapplicationsGetJoinEligibility,
	mesubscriptionsGetMySubscription
} from '$lib/api/generated/sdk.gen';
import type {
	MembershipEligibilitySchema,
	MySubscriptionSchema,
	OrganizationRetrieveSchema,
	PublicMembershipTierSchema,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

// ApplyDialog (mounted by every tier CTA) invalidates the page data on success.
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

// Only the two lookups the grid makes are stubbed; the rest of the generated
// client stays real so the dialogs mounted alongside it keep their own imports.
vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	mesubscriptionsGetMySubscription: vi.fn(),
	memembershipapplicationsGetJoinEligibility: vi.fn()
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

function makeEligibility(
	overrides: Partial<MembershipEligibilitySchema> = {}
): MembershipEligibilitySchema {
	return { allowed: true, organization_id: 'org-1', ...overrides };
}

/** One verdict for every tier, unless a test keys them apart itself. */
function mockEligibility(eligibility: MembershipEligibilitySchema) {
	vi.mocked(memembershipapplicationsGetJoinEligibility).mockResolvedValue({
		data: eligibility,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof memembershipapplicationsGetJoinEligibility>>);
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

function makeTier(overrides: Partial<PublicMembershipTierSchema> = {}): PublicMembershipTierSchema {
	return {
		id: 't-gold',
		name: 'Gold',
		description: null,
		display_order: 0,
		requires_approval: false,
		questionnaire_id: null,
		plans: [],
		is_free: true,
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
		mockEligibility(makeEligibility());
	});

	function renderSection(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: MembershipSection,
				componentProps: {
					organization: makeOrg(),
					tiers: [],
					isAuthenticated: true,
					...props
				}
			}
		});
	}

	// The page exists to answer "how do I join this org", so it answers even when
	// the answer is "you can't yet" — unlike the old landing-page section, which
	// rendered nothing at all.
	it('says so plainly when the organization has published no tiers', () => {
		renderSection();
		expect(screen.getByRole('heading', { level: 1, name: 'Membership' })).toBeInTheDocument();
		expect(
			screen.getByText(m['membershipTiers.empty']({ organizationName: 'Acme' }))
		).toBeInTheDocument();
	});

	// The bug this whole issue is about: the grid used to be built by grouping the
	// PLANS endpoint by tier, so a tier with no plan produced zero cards and could
	// never be chosen — which is precisely the free, questionnaire-gated tier.
	it('renders a plan-less tier as a real, joinable card', async () => {
		renderSection({
			tiers: [makeTier({ id: 't-free', name: 'Supporter', is_free: true, plans: [] })]
		});

		expect(screen.getByRole('heading', { level: 3, name: 'Supporter' })).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'Join Supporter' })).toBeInTheDocument();
	});

	// `display_order` is the organizer's decision and the backend already applied
	// it; re-sorting here (the old alphabetical grouping) would override them.
	it('keeps the backend display order', () => {
		renderSection({
			tiers: [
				makeTier({ id: 't-basic', name: 'Basic', display_order: 0 }),
				makeTier({ id: 't-gold', name: 'Gold', display_order: 1 }),
				makeTier({ id: 't-alpha', name: 'Alpha', display_order: 2 })
			]
		});

		expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
			'Basic',
			'Gold',
			'Alpha'
		]);
	});

	it("lists a tier's plans cheapest first", () => {
		renderSection({
			tiers: [
				makeTier({
					id: 't-gold',
					name: 'Gold',
					is_free: false,
					plans: [
						makePlan({ id: 'p-annual', name: 'Annual', price: '100.00' }),
						makePlan({ id: 'p-monthly', name: 'Monthly', price: '10.00' })
					]
				})
			]
		});

		expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([
			'Monthly',
			'Annual'
		]);
	});

	// Since BE #831 gated and monetized are not mutually exclusive: the same tier
	// can want a questionnaire AND charge for a plan, so both affordances have to
	// coexist on one card.
	it('shows the gates and the plans of a tier that is both gated and paid', () => {
		renderSection({
			tiers: [
				makeTier({
					id: 't-gold',
					name: 'Gold',
					is_free: false,
					requires_approval: true,
					questionnaire_id: 'q1',
					plans: [makePlan({ id: 'p-monthly', name: 'Monthly' })]
				})
			]
		});

		expect(screen.getByText(m['membershipTiers.requiresApproval']())).toBeInTheDocument();
		expect(screen.getByText(m['membershipTiers.questionnaireRequired']())).toBeInTheDocument();
		expect(
			screen.getByRole('link', {
				name: m['membershipTiers.questionnaireLinkAria']({ tier: 'Gold' })
			})
		).toHaveAttribute('href', '/org/acme/questionnaire/q1');
		expect(screen.getByRole('heading', { level: 4, name: 'Monthly' })).toBeInTheDocument();
	});

	// Per-tier verdicts: one tier joinable while its neighbour wants a
	// questionnaire. A shared cache key would have served the first answer to both.
	it('renders a different CTA per tier from per-tier verdicts', async () => {
		vi.mocked(memembershipapplicationsGetJoinEligibility).mockImplementation((async (options: {
			query?: { tier_id?: string };
		}) => ({
			data:
				options.query?.tier_id === 't-open'
					? makeEligibility({ allowed: true })
					: makeEligibility({
							allowed: false,
							next_step: 'submit_questionnaire',
							questionnaire_id: 'q1'
						}),
			error: undefined,
			response: { ok: true } as unknown as Response
		})) as unknown as typeof memembershipapplicationsGetJoinEligibility);

		renderSection({
			tiers: [
				makeTier({ id: 't-open', name: 'Open' }),
				makeTier({ id: 't-gated', name: 'Gated', questionnaire_id: 'q1' })
			]
		});

		expect(await screen.findByRole('button', { name: 'Join Open' })).toBeInTheDocument();
		expect(
			await screen.findByRole('link', { name: m['membershipEligibility.questionnaireCta']() })
		).toBeInTheDocument();
	});

	// Owners and staff are configuring this page, not shopping on it: N eligibility
	// round trips would answer a question they never asked.
	it('shows the owner badge instead of a join CTA on every tier', async () => {
		renderSection({
			isOwner: true,
			tiers: [
				makeTier({ id: 't-gold', name: 'Gold' }),
				makeTier({ id: 't-silver', name: 'Silver' })
			]
		});

		expect(screen.getByRole('status')).toHaveTextContent(/owner/i);
		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
		});
		expect(screen.queryByRole('button', { name: /^join /i })).toBeNull();
	});

	// The grid is one query away from the truth `OrgMembershipInline` already
	// shows; before #803 it never asked, and offered a paying member a concrete new
	// charge the backend can only refuse with a 400.
	describe('for a member who already subscribes here', () => {
		const paidTier = makeTier({
			id: 't-gold',
			name: 'Gold',
			is_free: false,
			plans: [
				makePlan({ id: 'p-gold-monthly', tier_id: 't-gold', name: 'Gold monthly' }),
				makePlan({ id: 'p-gold-annual', tier_id: 't-gold', name: 'Annual', price: '100.00' })
			]
		});

		it('withdraws Subscribe from every plan and marks the one they are on', async () => {
			mockSub(makeSub({ plan_id: 'p-gold-monthly' }));
			renderSection({ tiers: [paidTier] });

			await waitFor(() => {
				expect(screen.getByText('Your plan')).toBeInTheDocument();
			});
			expect(screen.queryByRole('button', { name: /^subscribe$/i })).toBeNull();
			expect(screen.getByText(/already have a subscription/i)).toBeInTheDocument();
			// The plans themselves stay on the page — they are still the org's offer.
			expect(screen.getByRole('heading', { level: 4, name: 'Annual' })).toBeInTheDocument();
		});

		// Cancelled and expired rows are excluded by the endpoint, so a member
		// whose membership ended looks exactly like a newcomer and can rejoin.
		it('keeps Subscribe for a member whose subscription has ended', async () => {
			mockSub(null);
			renderSection({ tiers: [paidTier] });

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
		const tiers = [makeTier({ is_free: false, plans: [makePlan()] })];
		const { unmount } = renderSection({ tiers });
		expect(screen.queryByText('Refund policy')).toBeNull();
		unmount();

		renderSection({
			tiers,
			organization: makeOrg({ membership_refund_policy: 'No refunds after 14 days.' })
		});
		expect(screen.getByText('Refund policy')).toBeInTheDocument();
	});
});
