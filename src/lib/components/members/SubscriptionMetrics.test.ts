import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SubscriptionMetrics from './SubscriptionMetrics.svelte';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsGetSubscriptionMetrics: vi.fn()
}));
import { organizationadminsubscriptionsGetSubscriptionMetrics } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const organization = { slug: 'test-org' } as OrganizationAdminDetailSchema;

const metrics = {
	as_of: '2026-07-25T12:00:00Z',
	active_count: 42,
	mrr: '630.00',
	mrr_currency: 'EUR',
	mixed_currency_warning: false,
	new_subscribers_30d: 5,
	churned_30d: 3,
	churn_rate_30d: 0.0667,
	status_breakdown: { pending: 1, active: 40, paused: 2, past_due: 2, cancelled: 7, expired: 4 }
};

describe('SubscriptionMetrics', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.mocked(organizationadminsubscriptionsGetSubscriptionMetrics).mockResolvedValue({
			data: metrics,
			error: undefined
		} as never);
	});

	function renderMetrics() {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: SubscriptionMetrics,
				props: { organization }
			}
		});
	}

	it('renders MRR, active count and churn', async () => {
		renderMetrics();
		// Intl currency output is locale-dependent — assert on the amount, not the exact format
		expect(await screen.findByText(/630/)).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();
		expect(screen.getByText(/6\.7\s?%/)).toBeInTheDocument();
	});

	it('shows the mixed-currency warning instead of an MRR figure', async () => {
		vi.mocked(organizationadminsubscriptionsGetSubscriptionMetrics).mockResolvedValue({
			data: { ...metrics, mrr: '0', mrr_currency: 'MIXED', mixed_currency_warning: true },
			error: undefined
		} as never);
		renderMetrics();
		expect(await screen.findByText(/multiple currencies/i)).toBeInTheDocument();
	});
});
