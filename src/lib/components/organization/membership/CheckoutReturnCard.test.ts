import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import CheckoutReturnCard from './CheckoutReturnCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	mesubscriptionsGetMySubscription,
	mesubscriptionsSubscribe
} from '$lib/api/generated/sdk.gen';
import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
import { invalidateAll } from '$app/navigation';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsGetMySubscription: vi.fn(),
	mesubscriptionsSubscribe: vi.fn()
}));

// The card re-runs the page's server load once the webhook has landed.
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 's1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
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
			payment_method: 'online',
			sales_status: 'open',
			is_active: true
		},
		...overrides
	} as MySubscriptionSchema;
}

function subResult(sub: MySubscriptionSchema | null) {
	return {
		data: sub ?? undefined,
		// django-ninja's wire shape for a refusal is `{ detail }`, never `{ message }`.
		error: sub ? undefined : { detail: 'Not found' },
		response: { ok: !!sub } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof mesubscriptionsGetMySubscription>>;
}

function mockGetSub(sub: MySubscriptionSchema | null) {
	vi.mocked(mesubscriptionsGetMySubscription).mockResolvedValue(subResult(sub));
}

/**
 * The backend's activation-pending 409: the member already paid and only the
 * activation webhooks are outstanding. `code` is the contract — `detail` is
 * translated server-side and must never be matched on.
 */
const ACTIVATION_PENDING_DETAIL =
	"Your payment went through. We're still confirming your subscription — check back in a moment.";

function mockSubscribeActivationPending() {
	vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
		data: undefined,
		error: { detail: ACTIVATION_PENDING_DETAIL, code: 'subscription_activation_pending' },
		response: { ok: false, status: 409 } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
}

describe('CheckoutReturnCard', () => {
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

	function renderCard(outcome: 'success' | 'cancelled') {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: CheckoutReturnCard,
				componentProps: { organizationId: 'org-1', organizationSlug: 'test-org', outcome }
			}
		});
	}

	it('welcomes the member and flips every stale view exactly once when the sub is active', async () => {
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
		mockGetSub(makeSub({ status: 'active' }));
		renderCard('success');

		await waitFor(() => {
			expect(screen.getByText('Welcome, member!')).toBeInTheDocument();
		});
		expect(screen.getByText(/your subscription is active/i)).toBeInTheDocument();

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['me', 'org', 'org-1', 'subscription']
			});
		});
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['organization', 'test-org'] });
		// Without this the action row keeps offering "Join" next to the welcome.
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['org', 'test-org', 'join-eligibility']
		});
		// …and the server-rendered `isMember` stays false until a manual reload.
		expect(vi.mocked(invalidateAll)).toHaveBeenCalledTimes(1);

		function callsFor(head: unknown) {
			return invalidateSpy.mock.calls.filter(([arg]) => {
				const key = (arg as { queryKey?: unknown[] } | undefined)?.queryKey;
				return Array.isArray(key) && key[0] === head;
			});
		}
		// The transition guard holds for all four side effects, not just the first.
		expect(callsFor('me')).toHaveLength(1);
		expect(callsFor('organization')).toHaveLength(1);
		expect(callsFor('org')).toHaveLength(1);
	});

	it('announces the confirming state in a live region while the sub is still pending', async () => {
		mockGetSub(makeSub({ status: 'pending' }));
		renderCard('success');

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent(/confirming your subscription/i);
		});
		expect(screen.queryByText('Welcome, member!')).toBeNull();
	});

	it('offers Resume payment for a pending sub after a cancelled checkout', async () => {
		const user = userEvent.setup();
		mockGetSub(makeSub({ status: 'pending', plan_id: 'plan-7' }));
		vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
			data: { subscription: { id: 's1' }, checkout_url: 'https://stripe.test/resume' },
			error: undefined,
			response: { ok: true } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		renderCard('cancelled');

		expect(screen.getByText(/checkout not completed/i)).toBeInTheDocument();

		const resume = await screen.findByRole('button', { name: /resume payment/i });
		await user.click(resume);

		await waitFor(() => {
			expect(vi.mocked(mesubscriptionsSubscribe)).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_id: 'org-1' },
					body: { plan_id: 'plan-7' }
				})
			);
		});
		await waitFor(() => {
			expect(window.location.href).toBe('https://stripe.test/resume');
		});
	});

	it('hides Resume payment when there is no pending subscription to resume', async () => {
		mockGetSub(null);
		renderCard('cancelled');

		await waitFor(() => {
			expect(vi.mocked(mesubscriptionsGetMySubscription)).toHaveBeenCalled();
		});
		expect(screen.getByText(/checkout not completed/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /resume payment/i })).toBeNull();
	});

	it('surfaces a failed resume attempt in an alert', async () => {
		const user = userEvent.setup();
		mockGetSub(makeSub({ status: 'pending', plan_id: 'plan-7' }));
		vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
			data: undefined,
			error: { detail: 'Plan is no longer available.' },
			response: { ok: false } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		renderCard('cancelled');

		await user.click(await screen.findByRole('button', { name: /resume payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Plan is no longer available.');
		});
		expect(window.location.href).toBe('');
	});

	// The money-critical refusal: the backend raises this 400 when the abandoned
	// session turned out to be paid and the activation webhook is still in
	// flight. Collapsing it into "could not start the checkout" would tell a
	// member who has already been charged that nothing went through.
	it('surfaces the duplicate-subscription refusal verbatim rather than generic copy', async () => {
		const user = userEvent.setup();
		mockGetSub(makeSub({ status: 'pending', plan_id: 'plan-7' }));
		vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
			data: undefined,
			error: { detail: 'This user already has an active subscription in this organization.' },
			response: { ok: false, status: 400 } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		renderCard('cancelled');

		await user.click(await screen.findByRole('button', { name: /resume payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(
				'This user already has an active subscription in this organization.'
			);
		});
		expect(screen.queryByText(/could not start the checkout/i)).toBeNull();
		expect(window.location.href).toBe('');
	});

	// The member has been charged; rendering this as a failure would tell someone
	// whose money is already gone that nothing went through.
	it('switches the cancelled card into the confirming state on the activation-pending 409', async () => {
		const user = userEvent.setup();
		mockGetSub(makeSub({ status: 'pending', plan_id: 'plan-7' }));
		mockSubscribeActivationPending();
		renderCard('cancelled');

		await user.click(await screen.findByRole('button', { name: /resume payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent(/confirming your subscription/i);
		});
		// The backend's own translated sentence, so the member can tell they are
		// not being asked to pay a second time.
		expect(screen.getByRole('status')).toHaveTextContent(/your payment went through/i);
		// Not an error, and no longer an invitation to pay again.
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText(/checkout not completed/i)).toBeNull();
		expect(screen.queryByRole('button', { name: /resume payment/i })).toBeNull();
		expect(window.location.href).toBe('');
	});

	it('starts polling for the activation after the activation-pending 409', async () => {
		const user = userEvent.setup();
		// First look (the cancelled card's one-shot) still says pending; every
		// later look — i.e. the poll — sees the webhook landed.
		vi.mocked(mesubscriptionsGetMySubscription)
			.mockResolvedValueOnce(subResult(makeSub({ status: 'pending', plan_id: 'plan-7' })))
			.mockResolvedValue(subResult(makeSub({ status: 'active', plan_id: 'plan-7' })));
		mockSubscribeActivationPending();
		renderCard('cancelled');

		await user.click(await screen.findByRole('button', { name: /resume payment/i }));

		// The poll is what turns the wait into a welcome; without it the card would
		// sit on "confirming" until the deadline lapsed.
		await waitFor(() => {
			expect(screen.getByText('Welcome, member!')).toBeInTheDocument();
		});
		expect(vi.mocked(mesubscriptionsGetMySubscription).mock.calls.length).toBeGreaterThan(1);
		expect(vi.mocked(invalidateAll)).toHaveBeenCalledTimes(1);
	});

	// Only the `code` may switch the card into the wait: a refusal that merely
	// looks similar is still a refusal.
	it('keeps rendering a plain 400 refusal as an error', async () => {
		const user = userEvent.setup();
		mockGetSub(makeSub({ status: 'pending', plan_id: 'plan-7' }));
		vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
			data: undefined,
			error: { detail: 'This plan is sold out.' },
			response: { ok: false, status: 400 } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		renderCard('cancelled');

		await user.click(await screen.findByRole('button', { name: /resume payment/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('This plan is sold out.');
		});
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.getByText(/checkout not completed/i)).toBeInTheDocument();
	});

	it('does not poll for a subscription on the cancelled outcome', async () => {
		mockGetSub(makeSub({ status: 'pending' }));
		renderCard('cancelled');

		await waitFor(() => {
			expect(vi.mocked(mesubscriptionsGetMySubscription)).toHaveBeenCalledTimes(1);
		});
		expect(screen.queryByText(/confirming your subscription/i)).toBeNull();
	});
});
