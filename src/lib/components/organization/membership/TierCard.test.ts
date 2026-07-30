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
});
