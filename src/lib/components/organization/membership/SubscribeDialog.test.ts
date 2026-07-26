import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscribeDialog from './SubscribeDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { mesubscriptionsSubscribe } from '$lib/api/generated/sdk.gen';
import type { PublicPlanSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsSubscribe: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

type Plan = PublicPlanSchema & { id: string };

function makePlan(overrides: Partial<PublicPlanSchema> = {}): Plan {
	return {
		id: 'plan-1',
		tier_id: 'tier-1',
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
	} as Plan;
}

function mockSubscribeSuccess(checkoutUrl = 'https://stripe.test/checkout/x') {
	vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
		data: { subscription: { id: 's1' }, checkout_url: checkoutUrl },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
}

function mockSubscribeError(message: string) {
	vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
		data: undefined,
		error: { message },
		response: { ok: false } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
}

describe('SubscribeDialog', () => {
	let queryClient: QueryClient;
	let originalLocation: Location;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		// jsdom refuses real navigation, so `window.location` is swapped for a
		// plain writable stand-in for the duration of each test.
		originalLocation = window.location;
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { href: '' } as Location
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
	});

	function renderDialog(props: Record<string, unknown> = {}) {
		const onOpenChange = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: SubscribeDialog,
				props: {
					open: true,
					onOpenChange,
					plan: makePlan(),
					tierName: 'Gold',
					organizationId: 'org-1',
					organizationName: 'Test Org',
					refundPolicy: null,
					...props
				}
			}
		});
		return { ...result, onOpenChange };
	}

	it('shows the plan, tier, price and the auto-renew and Stripe copy', () => {
		renderDialog();

		expect(screen.getByRole('heading', { name: /subscribe to monthly/i })).toBeInTheDocument();
		expect(screen.getByText('Gold')).toBeInTheDocument();
		expect(screen.getByText('Test Org')).toBeInTheDocument();
		expect(screen.getByText(/€10\.00 \/ month/)).toBeInTheDocument();
		expect(
			screen.getByText(/renews automatically every month until you cancel/i)
		).toBeInTheDocument();
		expect(screen.getByText(/processed securely by stripe/i)).toBeInTheDocument();
	});

	it('pluralises the renewal cadence for multi-period plans', () => {
		renderDialog({ plan: makePlan({ period_unit: 'month', period_count: 3 }) });
		expect(
			screen.getByText(/renews automatically every 3 months until you cancel/i)
		).toBeInTheDocument();
	});

	it('renders the refund policy only when the organization has one', async () => {
		const { unmount } = renderDialog();
		expect(screen.queryByText(/refund policy/i)).toBeNull();
		unmount();

		renderDialog({ refundPolicy: 'No refunds after 14 days.' });
		expect(screen.getByText(/refund policy/i)).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.getByText(/no refunds after 14 days/i)).toBeInTheDocument();
		});
	});

	it('subscribes and redirects to the returned checkout URL', async () => {
		const user = userEvent.setup();
		mockSubscribeSuccess('https://stripe.test/checkout/abc');
		renderDialog();

		await user.click(screen.getByRole('button', { name: /continue to payment/i }));

		await waitFor(() => {
			expect(vi.mocked(mesubscriptionsSubscribe)).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_id: 'org-1' },
					body: { plan_id: 'plan-1' }
				})
			);
		});
		await waitFor(() => {
			expect(window.location.href).toBe('https://stripe.test/checkout/abc');
		});
	});

	it('renders the backend error message in an alert and keeps the dialog usable', async () => {
		const user = userEvent.setup();
		mockSubscribeError('Plan is sold out.');
		renderDialog();

		await user.click(screen.getByRole('button', { name: /continue to payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Plan is sold out.');
		});
		expect(window.location.href).toBe('');
		// The observer's pending→error flip is batched by TanStack's notify
		// manager, so it lands a tick after the (synchronously set) error copy.
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled();
		});
	});

	it('falls back to the generic error copy when the backend sends no message', async () => {
		const user = userEvent.setup();
		vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { ok: false } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		renderDialog();

		await user.click(screen.getByRole('button', { name: /continue to payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(/could not start the checkout/i);
		});
	});

	it('asks the caller to close when Cancel is pressed', async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderDialog();
		await user.click(screen.getByRole('button', { name: /^cancel$/i }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
