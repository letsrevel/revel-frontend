import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import TierCard from './TierCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { memembershipapplicationsGetJoinEligibility } from '$lib/api/generated/sdk.gen';
import type {
	MembershipEligibilitySchema,
	PublicMembershipTierSchema,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	memembershipapplicationsGetJoinEligibility: vi.fn()
}));

function mockEligibility(overrides: Partial<MembershipEligibilitySchema> = {}) {
	vi.mocked(memembershipapplicationsGetJoinEligibility).mockResolvedValue({
		data: { allowed: true, organization_id: 'org-1', ...overrides },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof memembershipapplicationsGetJoinEligibility>>);
}

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
	return {
		id: 'plan-1',
		tier_id: 't-gold',
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

describe('TierCard', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		mockEligibility();
	});

	function renderCard(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: TierCard,
				componentProps: {
					tier: makeTier(),
					organizationSlug: 'acme',
					organizationName: 'Acme',
					isAuthenticated: true,
					onSubscribe: vi.fn(),
					...props
				}
			}
		});
	}

	// The cards are peers in a grid, so each has to announce which tier it is
	// before anything inside it makes sense (WCAG 1.3.1).
	it('names itself after its tier', () => {
		renderCard({ tier: makeTier({ name: 'Supporter' }) });

		expect(screen.getByRole('article', { name: 'Supporter' })).toBeInTheDocument();
	});

	it('renders the tier description as markdown', () => {
		renderCard({ tier: makeTier({ description: 'Access to **everything**.' }) });

		expect(screen.getByText('everything').tagName).toBe('STRONG');
	});

	// Not colour: an icon plus its own words, so the state survives greyscale and
	// every form of colour blindness.
	it('states the approval gate in words', () => {
		renderCard({ tier: makeTier({ requires_approval: true }) });

		expect(screen.getByText(m['membershipTiers.requiresApproval']())).toBeInTheDocument();
	});

	it('links the questionnaire gate at the questionnaire itself', () => {
		renderCard({ tier: makeTier({ name: 'Gold', questionnaire_id: 'q-42' }) });

		expect(
			screen.getByRole('link', {
				name: m['membershipTiers.questionnaireLinkAria']({ tier: 'Gold' })
			})
		).toHaveAttribute('href', '/org/acme/questionnaire/q-42');
	});

	it('marks a plan-less tier as free and still offers a join CTA', async () => {
		renderCard({ tier: makeTier({ name: 'Supporter', is_free: true, plans: [] }) });

		expect(screen.getByText(m['membershipTiers.freeBadge']())).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'Join Supporter' })).toBeInTheDocument();
	});

	it('renders the plans of a paid tier and drops the free badge', () => {
		renderCard({
			tier: makeTier({
				is_free: false,
				plans: [makePlan({ id: 'p-1', name: 'Monthly' })]
			})
		});

		expect(screen.getByRole('heading', { level: 4, name: 'Monthly' })).toBeInTheDocument();
		expect(screen.queryByText(m['membershipTiers.freeBadge']())).toBeNull();
	});

	// Owner/staff: the page is configuration to them. Suppressed here rather than
	// in the CTA so no eligibility request is made at all.
	it('asks nothing and offers nothing when the join CTA is suppressed', async () => {
		renderCard({ showJoinCta: false });

		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
		});
		expect(screen.queryByRole('button', { name: /^join /i })).toBeNull();
	});

	// A tier the backend serialized without an id cannot be applied to (there is no
	// `tier_id` to post), so it must not grow a button that could only fail.
	it('omits the CTA for a tier with no id', async () => {
		renderCard({ tier: makeTier({ id: null }) });

		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalled();
		});
		expect(screen.queryByRole('button', { name: /^join /i })).toBeNull();
	});

	// #733. The tier's own fields say the tier IS GATED; only a verdict says this
	// VIEWER is behind the gate — and for a monetized tier that verdict has to
	// name a plan, because the backend's TierAvailabilityGate short-circuits a
	// plan-less check on any tier that sells something, long before the
	// questionnaire and approval gates run.
	describe('a gated, priced tier', () => {
		const gatedPaidTier = () =>
			makeTier({
				is_free: false,
				questionnaire_id: 'q-42',
				plans: [makePlan({ id: 'p-1', name: 'Monthly', price: '10.00' })]
			});

		it('asks about a plan, not just the tier', async () => {
			mockEligibility({ allowed: false, reason_code: 'membership_questionnaire_missing' });
			renderCard({ tier: gatedPaidTier() });

			await waitFor(() => {
				expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).toHaveBeenCalledWith(
					expect.objectContaining({ query: { tier_id: 't-gold', plan_id: 'p-1' } })
				);
			});
		});

		it('withdraws Subscribe and leaves the questionnaire as the only thing to press', async () => {
			mockEligibility({
				allowed: false,
				reason_code: 'membership_questionnaire_missing',
				next_step: 'submit_questionnaire',
				questionnaire_id: 'q-42'
			});
			renderCard({ tier: gatedPaidTier() });

			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			});
			// The plan card says, in its own words, why its CTA is gone…
			const note = screen.getByText(m['membershipPlans.gatedSubscribeHelper'](), { exact: false });
			expect(note).toHaveTextContent(
				m['membershipEligibility.reason.membership_questionnaire_missing']()
			);
			// The price the member is working toward is still on the card…
			expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
			// …and the way forward is the gate's own link.
			expect(
				screen.getByRole('link', {
					name: m['membershipTiers.questionnaireLinkAria']({ tier: 'Gold' })
				})
			).toHaveAttribute('href', '/org/acme/questionnaire/q-42');
		});

		// The crux, in the direction that matters most: a member who has already
		// passed the questionnaire must still be able to pay.
		it('keeps Subscribe for a viewer who has cleared the gate', async () => {
			mockEligibility({ allowed: true, next_step: 'proceed_to_payment', plan_id: 'p-1' });
			renderCard({ tier: gatedPaidTier() });

			expect(await screen.findByRole('button', { name: /subscribe/i })).toBeEnabled();
		});

		// Manual approval is the same shape, and it arrives from PaymentReadyGate
		// as `submit_application`: apply and be approved before there is anything
		// to pay for.
		it('withdraws Subscribe when the tier is approval-gated and nothing is on file', async () => {
			mockEligibility({
				allowed: false,
				reason_code: 'requires_approval',
				next_step: 'submit_application'
			});
			renderCard({
				tier: makeTier({
					is_free: false,
					requires_approval: true,
					plans: [makePlan({ id: 'p-1' })]
				})
			});

			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			});
			expect(
				screen.getByText(m['membershipPlans.gatedSubscribeHelper'](), { exact: false })
			).toHaveTextContent(m['membershipEligibility.reason.requires_approval']());
		});

		// A refusal about the PLAN rather than about the viewer: the plan card
		// already models sold-out, paused and offline itself, and a Stripe-less org
		// is not something the member can fill in a form to fix.
		it('does not read a payment-readiness refusal as a gate', async () => {
			mockEligibility({ allowed: false, reason_code: 'org_not_stripe_connected' });
			renderCard({ tier: gatedPaidTier() });

			expect(await screen.findByRole('button', { name: /subscribe/i })).toBeEnabled();
		});
	});

	// An ungated tier is exactly as it was: no verdict is asked for on its plans'
	// behalf, and nothing about the CTA changes.
	it('asks no plan-level question about an ungated tier', async () => {
		renderCard({
			tier: makeTier({ is_free: false, plans: [makePlan({ id: 'p-1' })] })
		});

		expect(await screen.findByRole('button', { name: /subscribe/i })).toBeEnabled();
		expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalledWith(
			expect.objectContaining({ query: expect.objectContaining({ plan_id: 'p-1' }) })
		);
	});

	// Every plan on the tier is a dead end already, so there is no CTA for a
	// verdict to withdraw — and no reason to spend a round trip finding out.
	it('asks nothing when the tier sells only offline plans', async () => {
		renderCard({
			tier: makeTier({
				is_free: false,
				questionnaire_id: 'q-42',
				plans: [makePlan({ id: 'p-1', payment_method: 'offline' })]
			})
		});

		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsGetJoinEligibility)).not.toHaveBeenCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ plan_id: 'p-1' }) })
			);
		});
	});
});
