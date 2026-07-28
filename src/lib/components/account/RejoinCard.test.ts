import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { tick } from 'svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import RejoinCard from './RejoinCard.svelte';
import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
import { formatDate } from '$lib/utils/date';

const reviveMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsReviveSubscription: reviveMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

const EXPIRED_AT = '2026-07-01T00:00:00Z';
const DEADLINE = '2026-08-30T00:00:00Z';

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
		status: 'expired',
		current_period_start: '2026-06-01T00:00:00Z',
		current_period_end: EXPIRED_AT,
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: EXPIRED_AT,
		revival_deadline: DEADLINE,
		grace_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-06-01T00:00:00Z',
		updated_at: EXPIRED_AT,
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
	};
}

describe('RejoinCard', () => {
	let queryClient: QueryClient;
	let originalLocation: Location;

	function renderCard(sub: MySubscriptionSchema = makeSub()) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: RejoinCard, componentProps: { sub } }
		});
	}

	/**
	 * Resolves once the revive mutation has left `pending` for a terminal state
	 * *and* Svelte has flushed the resulting `isPending` change into the DOM —
	 * without the flush, a still-stale `disabled` attribute would satisfy any
	 * assertion made right after settlement.
	 */
	async function settledMutation() {
		await waitFor(() => {
			const [mutation] = queryClient.getMutationCache().getAll();
			expect(mutation).toBeDefined();
			expect(mutation.state.status).not.toBe('pending');
		});
		// The cache settles before the component hears about it: TanStack batches
		// subscriber notifications, so drain the macrotask queue first, then let
		// Svelte flush the resulting `isPending` change into the DOM.
		await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
	}

	beforeEach(() => {
		reviveMock.mockReset();
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

	it('names the organization, both dates and the plan price', () => {
		renderCard();

		expect(
			screen.getByRole('heading', { name: /your membership at test org has expired/i })
		).toBeInTheDocument();
		expect(
			screen.getByText(new RegExp(`${formatDate(EXPIRED_AT)}[\\s\\S]*${formatDate(DEADLINE)}`, 'i'))
		).toBeInTheDocument();
		expect(screen.getByText(/Monthly · €10\.00 \/ month/)).toBeInTheDocument();
		// The Stripe return lands on the org page, not here — say so up front.
		expect(screen.getByText(/return to the organization's page/i)).toBeInTheDocument();
	});

	it('revives with an empty body and hands the browser to Stripe', async () => {
		const user = userEvent.setup();
		reviveMock.mockResolvedValue({
			data: {
				subscription: makeSub({ status: 'pending' }),
				checkout_url: 'https://stripe.test/go'
			},
			error: undefined
		});
		renderCard();

		await user.click(screen.getByRole('button', { name: /rejoin/i }));

		await waitFor(() =>
			expect(reviveMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { org_id: 'org-1' }, body: {} })
			)
		);
		await waitFor(() => expect(window.location.href).toBe('https://stripe.test/go'));
		// Latched: the document is on its way out, so the CTA must not invite a
		// second click. Asserted only once the mutation has left `pending`, or
		// `isPending` alone could be keeping the button disabled.
		await settledMutation();
		expect(screen.getByRole('button', { name: /rejoin/i })).toBeDisabled();
	});

	it('alerts instead of navigating when the backend returns no checkout URL', async () => {
		const user = userEvent.setup();
		reviveMock.mockResolvedValue({
			data: { subscription: makeSub(), checkout_url: null },
			error: undefined
		});
		renderCard();

		await user.click(screen.getByRole('button', { name: /rejoin/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/could not start the payment/i);
		expect(window.location.href).toBe('');
	});

	it('surfaces a backend failure detail inline', async () => {
		const user = userEvent.setup();
		reviveMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'The revival window has closed.' }
		});
		renderCard();

		await user.click(screen.getByRole('button', { name: /rejoin/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent('The revival window has closed.');
		expect(window.location.href).toBe('');
	});
});
