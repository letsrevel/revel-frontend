import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipSection from './MembershipSection.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OrganizationRetrieveSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

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
