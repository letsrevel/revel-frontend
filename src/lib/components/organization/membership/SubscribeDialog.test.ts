import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscribeDialog from './SubscribeDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { mesubscriptionsSubscribe } from '$lib/api/generated/sdk.gen';
import { invalidateAll } from '$app/navigation';
import type { PublicPlanSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsSubscribe: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

// A free join grants the membership server-side, so the page's server load —
// which decided `isMember` before it existed — has to be re-run.
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
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

// django-ninja renders `HttpError` as `{"detail": ...}` — the generated type's
// `{ message }` is never what comes over the wire, so the refusal is mocked in
// the real shape.
function mockSubscribeError(detail: string) {
	vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
		data: undefined,
		error: { detail },
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
				componentProps: {
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

	// The first-charge line quotes the bare amount, not the rate — "€10.00 / month
	// now" would misstate what the confirm button actually does.
	it('states the first charge as a bare amount', () => {
		renderDialog();
		expect(
			screen.getByText("You'll be charged €10.00 now, then automatically each renewal.")
		).toBeInTheDocument();
	});

	it('quotes the plan price in the first-charge line for a multi-period plan', () => {
		renderDialog({ plan: makePlan({ price: '250.50', currency: 'EUR', period_count: 3 }) });
		expect(
			screen.getByText("You'll be charged €250.50 now, then automatically each renewal.")
		).toBeInTheDocument();
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

	// The one canonical "how membership billing works" disclosure. It quotes the
	// org's real policy numbers, so each way those numbers can arrive (a real
	// count, the disabling `0`, or nothing at all) has to render copy that is
	// true — "a grace period of 0 days" and "within undefined days" are both
	// worse than no disclosure.
	describe('the billing disclosure', () => {
		/** The `<details>` wrapping the disclosure, found via its summary. */
		function billingDisclosure(): HTMLDetailsElement {
			const summary = screen.getByText('How billing works');
			const details = summary.closest('details');
			expect(details).not.toBeNull();
			return details as HTMLDetailsElement;
		}

		it('is present but collapsed by default', () => {
			renderDialog({ gracePeriodDays: 7, revivalWindowDays: 30 });
			expect(billingDisclosure().open).toBe(false);
		});

		it('always states the renewal reminder and the cancellation terms', () => {
			renderDialog({ gracePeriodDays: 7, revivalWindowDays: 30 });
			expect(screen.getByText(/renews automatically each period/i)).toBeInTheDocument();
			expect(screen.getByText(/you can cancel any time/i)).toBeInTheDocument();
			expect(screen.getByText(/not refunded automatically/i)).toBeInTheDocument();
		});

		it("quotes the organization's real grace period and revival window", () => {
			renderDialog({ gracePeriodDays: 7, revivalWindowDays: 30 });
			expect(
				screen.getByText(/you keep access for 7 days after the period ends/i)
			).toBeInTheDocument();
			expect(screen.getByText(/restart it from your account within 30 days/i)).toBeInTheDocument();
		});

		it('uses singular day copy for one-day windows', () => {
			renderDialog({ gracePeriodDays: 1, revivalWindowDays: 1 });
			expect(
				screen.getByText(/you keep access for 1 day after the period ends/i)
			).toBeInTheDocument();
			expect(screen.getByText(/restart it from your account within 1 day\./i)).toBeInTheDocument();
		});

		// `0` grace is not "0 days of grace": the sweep expires the membership on
		// its first pass after the period ends.
		it('says there is no grace period when the org sets it to zero', () => {
			renderDialog({ gracePeriodDays: 0, revivalWindowDays: 30 });
			expect(screen.getByText(/there is no grace period/i)).toBeInTheDocument();
			expect(screen.queryByText(/keep access for 0 day/i)).toBeNull();
		});

		// `0` revival means the backend refuses revival outright — offering a
		// window would be a promise it will not honour.
		it('says the membership cannot be restarted when revival is disabled', () => {
			renderDialog({ gracePeriodDays: 7, revivalWindowDays: 0 });
			expect(screen.getByText(/it can't be restarted/i)).toBeInTheDocument();
			expect(screen.queryByText(/within 0 day/i)).toBeNull();
		});

		it('falls back to generic wording when the org payload omits the numbers', () => {
			renderDialog();
			expect(screen.getByText(/a short grace period/i)).toBeInTheDocument();
			expect(screen.getByText(/for a limited time/i)).toBeInTheDocument();
			expect(screen.queryByText(/undefined/i)).toBeNull();
			expect(screen.queryByText(/\bnull\b/i)).toBeNull();
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

	// The member already paid on an earlier attempt (double-submit, or a return to
	// the page while the webhook was still in flight). Showing "could not start
	// the checkout" here would tell someone who has been charged that nothing
	// went through.
	describe('when the subscribe is refused as activation-pending', () => {
		const ACTIVATION_PENDING_DETAIL =
			"Your payment went through. We're still confirming your subscription — check back in a moment.";

		function mockActivationPending() {
			vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
				data: undefined,
				error: { detail: ACTIVATION_PENDING_DETAIL, code: 'subscription_activation_pending' },
				response: { ok: false, status: 409 } as unknown as Response
			} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		}

		it('replaces the body with an announced confirming wait, not an error', async () => {
			const user = userEvent.setup();
			mockActivationPending();
			renderDialog();

			await user.click(screen.getByRole('button', { name: /continue to payment/i }));

			await waitFor(() => {
				expect(screen.getByRole('status')).toHaveTextContent(/confirming your subscription/i);
			});
			expect(screen.getByRole('status')).toHaveTextContent(/your payment went through/i);
			expect(screen.queryByRole('alert')).toBeNull();
			// The charge quote is withdrawn: nothing further is owed.
			expect(screen.queryByText(/you'll be charged/i)).toBeNull();
			expect(window.location.href).toBe('');
		});

		it('withdraws the retry CTA and leaves only a way out', async () => {
			const user = userEvent.setup();
			mockActivationPending();
			const { onOpenChange } = renderDialog();

			await user.click(screen.getByRole('button', { name: /continue to payment/i }));

			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /continue to payment/i })).toBeNull();
			});
			expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull();

			// Two buttons answer to "Close" now: the footer's, and the dialog's own ✕
			// — which `dialog-content.svelte` renders after the children, so the
			// footer's is first in DOM order. The ✕ is suppressed while `isBusy`, and
			// `activationPending` flips *inside* the mutation fn — one tick before the
			// mutation itself settles — so the ✕ returns a beat after the body swaps.
			await waitFor(() => {
				expect(screen.getAllByRole('button', { name: /^close$/i })).toHaveLength(2);
			});
			const closers = screen.getAllByRole('button', { name: /^close$/i });
			await user.click(closers[0]);
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		// Only the `code` may switch the dialog into the wait.
		it('keeps rendering a plain 400 refusal as an error', async () => {
			const user = userEvent.setup();
			vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
				data: undefined,
				error: { detail: 'This plan is sold out.' },
				response: { ok: false, status: 400 } as unknown as Response
			} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
			renderDialog();

			await user.click(screen.getByRole('button', { name: /continue to payment/i }));

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent('This plan is sold out.');
			});
			expect(screen.queryByRole('status')).toBeNull();
			expect(screen.getByRole('button', { name: /continue to payment/i })).toBeInTheDocument();
		});
	});

	// A FREE plan has no Stripe object: `checkout_url` comes back null and the
	// subscription is already ACTIVE. Every line that quotes a charge, a renewal
	// or Stripe would be false, and there is no return page to report the result,
	// so the dialog has to do it itself.
	describe('a free plan', () => {
		const freePlan = () =>
			makePlan({
				name: 'Supporter',
				payment_method: 'free',
				price: '0.00',
				period_unit: 'lifetime'
			});

		/** The FREE answer: no session, and the row already active. */
		function mockFreeSubscribe() {
			vi.mocked(mesubscriptionsSubscribe).mockResolvedValue({
				data: {
					subscription: {
						id: 's1',
						organization_id: 'org-1',
						plan_id: 'plan-1',
						status: 'active',
						current_period_end: null
					},
					checkout_url: null
				},
				error: undefined,
				response: { ok: true } as unknown as Response
			} as unknown as Awaited<ReturnType<typeof mesubscriptionsSubscribe>>);
		}

		it('withdraws every charge, renewal and Stripe claim', () => {
			renderDialog({ plan: freePlan(), refundPolicy: 'No refunds after 14 days.' });

			expect(screen.getByRole('heading', { name: /join supporter/i })).toBeInTheDocument();
			expect(screen.getByText('Free')).toBeInTheDocument();
			expect(screen.getByText(/there's nothing to pay/i)).toBeInTheDocument();
			expect(screen.getByText(/never expires and is never renewed/i)).toBeInTheDocument();
			expect(screen.queryByText(/you'll be charged/i)).toBeNull();
			expect(screen.queryByText(/renews automatically/i)).toBeNull();
			expect(screen.queryByText(/how billing works/i)).toBeNull();
			expect(screen.queryByText(/refund policy/i)).toBeNull();
			expect(screen.queryByText(/processed securely by stripe/i)).toBeNull();
			expect(screen.getByRole('button', { name: /join now/i })).toBeInTheDocument();
		});

		it('reports the membership as live instead of navigating anywhere', async () => {
			const user = userEvent.setup();
			mockFreeSubscribe();
			renderDialog({ plan: freePlan() });

			await user.click(screen.getByRole('button', { name: /join now/i }));

			await waitFor(() => {
				expect(screen.getByRole('status')).toHaveTextContent(/welcome, member/i);
			});
			expect(screen.queryByRole('alert')).toBeNull();
			// No Checkout session exists, so nothing may replace the document.
			expect(window.location.href).toBe('');
		});

		// The org page cached "not a member" before the join; nothing else will
		// refresh it, because there is no Stripe return page to mount.
		it('refreshes the caches that still say the viewer is not a member', async () => {
			const user = userEvent.setup();
			const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
			mockFreeSubscribe();
			renderDialog({ plan: freePlan() });

			await user.click(screen.getByRole('button', { name: /join now/i }));

			await waitFor(() => {
				expect(vi.mocked(invalidateAll)).toHaveBeenCalledTimes(1);
			});
			const keys = invalidateSpy.mock.calls.map(
				([arg]) => (arg as { queryKey?: unknown[] } | undefined)?.queryKey?.[0]
			);
			// The per-org subscription cache the inline membership card reads…
			expect(keys).toContain('me');
			// …the join-eligibility verdict, and the admin views of this org.
			expect(keys).toContain('org');
			expect(keys).toContain('organization');
		});

		it('withdraws the confirm CTA once the join has landed', async () => {
			const user = userEvent.setup();
			mockFreeSubscribe();
			const { onOpenChange } = renderDialog({ plan: freePlan() });

			await user.click(screen.getByRole('button', { name: /join now/i }));

			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /join now/i })).toBeNull();
			});
			expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull();

			// Two answer to "Close" now: the footer's and the dialog's own ✕.
			await waitFor(() => {
				expect(screen.getAllByRole('button', { name: /^close$/i })).toHaveLength(2);
			});
			await user.click(screen.getAllByRole('button', { name: /^close$/i })[0]);
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		// A refusal is still a refusal: the free path must not swallow one.
		it('renders a refusal as an error, not as a successful join', async () => {
			const user = userEvent.setup();
			mockSubscribeError('This plan is sold out.');
			renderDialog({ plan: freePlan() });

			await user.click(screen.getByRole('button', { name: /join now/i }));

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent('This plan is sold out.');
			});
			expect(screen.queryByRole('status')).toBeNull();
		});
	});

	it('asks the caller to close when Cancel is pressed', async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderDialog();
		await user.click(screen.getByRole('button', { name: /^cancel$/i }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('closes through the ✕ button when idle', async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderDialog();
		await user.click(screen.getByRole('button', { name: /close/i }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// Every dismissal route has to funnel through the same guard. The ✕ that
	// `dialog-content.svelte` renders is the dangerous one: bits-ui tears the
	// dialog down itself, so an unguarded ✕ would unmount the content while the
	// parent's `open` stayed true — the dialog could never be reopened, and a
	// late error alert would render into a detached tree.
	describe('while a checkout session is being created', () => {
		/** Leaves the mutation pending forever so the guard stays engaged. */
		function renderPending() {
			// Definite assignment: a Promise executor runs synchronously, so
			// `release` is bound before `renderPending` returns.
			let release!: (value: unknown) => void;
			vi.mocked(mesubscriptionsSubscribe).mockReturnValue(
				new Promise((resolve) => {
					release = resolve;
				}) as unknown as ReturnType<typeof mesubscriptionsSubscribe>
			);
			const handles = renderDialog();
			return { ...handles, release };
		}

		async function startCheckout(user: ReturnType<typeof userEvent.setup>) {
			await user.click(screen.getByRole('button', { name: /continue to payment/i }));
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
			});
		}

		it('ignores Escape', async () => {
			const user = userEvent.setup();
			const { onOpenChange } = renderPending();
			await startCheckout(user);

			await user.keyboard('{Escape}');

			expect(onOpenChange).not.toHaveBeenCalled();
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('withdraws the ✕ button so it cannot bypass the guard', async () => {
			const user = userEvent.setup();
			const { onOpenChange } = renderPending();
			expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();

			await startCheckout(user);

			expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
			expect(onOpenChange).not.toHaveBeenCalled();
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('ignores Cancel', async () => {
			const user = userEvent.setup();
			const { onOpenChange } = renderPending();
			await startCheckout(user);

			await user.click(screen.getByRole('button', { name: /^cancel$/i }));

			expect(onOpenChange).not.toHaveBeenCalled();
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('restores every dismissal route once the attempt settles', async () => {
			const user = userEvent.setup();
			const { onOpenChange, release } = renderPending();
			await startCheckout(user);

			release({
				data: undefined,
				error: { detail: 'Plan is sold out.' },
				response: { ok: false }
			});
			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent('Plan is sold out.');
			});
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /close/i }));
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});
});
