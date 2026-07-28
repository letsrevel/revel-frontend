import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionDrawer from './SubscriptionDrawer.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsCancelSubscription,
	organizationadminsubscriptionsGetSubscription,
	organizationadminsubscriptionsListSubscriptionPayments,
	organizationadminsubscriptionsPauseSubscription,
	organizationadminsubscriptionsUncancelSubscription
} from '$lib/api/generated/sdk.gen';
import type {
	OrganizationAdminDetailSchema,
	MembershipPaymentSchema,
	SubscriptionSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsGetSubscription: vi.fn(),
	organizationadminsubscriptionsListSubscriptionPayments: vi.fn(),
	organizationadminsubscriptionsRecordPayment: vi.fn(),
	organizationadminsubscriptionsCancelSubscription: vi.fn(),
	organizationadminsubscriptionsPauseSubscription: vi.fn(),
	organizationadminsubscriptionsResumeSubscription: vi.fn(),
	organizationadminsubscriptionsRefundPayment: vi.fn(),
	organizationadminsubscriptionsReviveSubscription: vi.fn(),
	organizationadminsubscriptionsUncancelSubscription: vi.fn()
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { error: toastErrorMock, success: toastSuccessMock, info: toastInfoMock }
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

const organization = {
	id: 'org-1',
	slug: 'test-org',
	name: 'Test Org'
} as unknown as OrganizationAdminDetailSchema;

function makeSub(overrides: Partial<SubscriptionSchema> = {}): SubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
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
		user_id: 'user-1',
		user_display_name: 'Ada Lovelace',
		user_email: 'ada@example.com',
		stripe_subscription_id: null,
		stripe_dashboard_url: null,
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
			payment_method: 'offline',
			sales_status: 'open',
			is_active: true
		},
		...overrides
	} as SubscriptionSchema;
}

function makePayment(overrides: Partial<MembershipPaymentSchema> = {}): MembershipPaymentSchema {
	return {
		id: 'pay-1',
		subscription_id: 'sub-1',
		status: 'succeeded',
		amount: '10.00',
		currency: 'EUR',
		notes: '',
		period_start: '2026-08-01T00:00:00Z',
		period_end: '2026-09-01T00:00:00Z',
		occurred_at: '2026-08-01T00:00:00Z',
		created_at: '2026-08-01T00:00:00Z',
		recorded_by_id: null,
		recorded_by_name: null,
		stripe_dashboard_url: null,
		stripe_invoice_id: null,
		stripe_payment_intent_id: null,
		...overrides
	} as MembershipPaymentSchema;
}

function arrange(sub: SubscriptionSchema, payments: MembershipPaymentSchema[] = []) {
	vi.mocked(organizationadminsubscriptionsGetSubscription).mockResolvedValue({
		data: sub,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsGetSubscription>>);
	vi.mocked(organizationadminsubscriptionsListSubscriptionPayments).mockResolvedValue({
		data: { results: payments, count: payments.length },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<
		ReturnType<typeof organizationadminsubscriptionsListSubscriptionPayments>
	>);
}

function renderDrawer() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});
	return render(QueryClientTestWrapper, {
		props: {
			client,
			component: SubscriptionDrawer,
			componentProps: {
				organization,
				subId: 'sub-1',
				open: true,
				onClose: vi.fn()
			}
		}
	});
}

// bits-ui pins pointer-events on <body> while a dialog is open, and this drawer
// *is* a dialog — jsdom keeps <body> across tests, so reset it or the first
// user-event click in a later test is swallowed.
beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('SubscriptionDrawer Stripe dashboard link', () => {
	it('links the subscription to Stripe when the admin schema carries a URL', async () => {
		arrange(
			makeSub({
				stripe_subscription_id: 'sub_stripe_1',
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/subscriptions/sub_stripe_1',
				plan: { ...makeSub().plan, payment_method: 'online' }
			})
		);
		renderDrawer();

		const link = await screen.findByRole('link', { name: 'Manage on Stripe' });
		expect(link).toHaveAttribute(
			'href',
			'https://dashboard.stripe.com/test/subscriptions/sub_stripe_1'
		);
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	// A PENDING row has no Stripe Subscription yet, so the backend falls back to the
	// hosted Checkout Session that will create one — that is what makes the "member
	// says they paid but it still shows PENDING" case inspectable. The session page
	// is not a management surface, so the label must not claim otherwise.
	it('links a pending subscription to its Checkout Session, labelled as a checkout', async () => {
		arrange(
			makeSub({
				status: 'pending',
				stripe_subscription_id: null,
				stripe_checkout_session_id: 'cs_test_1',
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/checkout/sessions/cs_test_1',
				plan: { ...makeSub().plan, payment_method: 'online' }
			})
		);
		renderDrawer();

		const link = await screen.findByRole('link', { name: 'View checkout on Stripe' });
		expect(link).toHaveAttribute(
			'href',
			'https://dashboard.stripe.com/test/checkout/sessions/cs_test_1'
		);
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		expect(screen.queryByText('Manage on Stripe')).not.toBeInTheDocument();
	});

	// `stripe_dashboard_url` is still null before a checkout session exists (and for
	// every OFFLINE plan) — no URL, no anchor.
	it('renders no Stripe link for a pending subscription with nothing to point at', async () => {
		arrange(
			makeSub({
				status: 'pending',
				stripe_dashboard_url: null,
				plan: { ...makeSub().plan, payment_method: 'online' }
			})
		);
		renderDrawer();

		await screen.findByText('ada@example.com');
		expect(screen.queryByText('View checkout on Stripe')).not.toBeInTheDocument();
		expect(screen.queryByText('Manage on Stripe')).not.toBeInTheDocument();
	});

	it('renders no Stripe link for an offline subscription', async () => {
		arrange(makeSub());
		renderDrawer();

		// Wait for the drawer body rather than the absent link, so the negative
		// assertion cannot pass merely because nothing has rendered yet. Queried by
		// text because `Button` degrades from <a> to <button> on a nullish href — a
		// role-scoped negative would miss a dead stub.
		await screen.findByText('ada@example.com');
		expect(screen.queryByText('Manage on Stripe')).not.toBeInTheDocument();
	});
});

describe('SubscriptionDrawer pause gating', () => {
	it('offers Pause on an active subscription that is still renewing', async () => {
		arrange(makeSub());
		renderDrawer();

		expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
		expect(
			screen.queryByText(/cancellation is scheduled|Undo cancellation first/i)
		).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Undo cancellation' })).not.toBeInTheDocument();
	});

	it('hides Pause and points at the undo when a cancellation is scheduled', async () => {
		arrange(makeSub({ cancel_at_period_end: true }));
		renderDrawer();

		// Anchor on the date line the scheduled cancellation renders, so the negative
		// assertion below cannot pass merely because the drawer body is still loading.
		await screen.findByText(/Cancels on/i);
		expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
		// The note must name the remedy, not merely describe the block (#808).
		expect(
			screen.getByText(
				"Pause isn't available while a cancellation is scheduled — Undo cancellation first."
			)
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Undo cancellation' })).toBeInTheDocument();
	});
});

describe('SubscriptionDrawer uncancel', () => {
	// Same gate as the service: non-terminal + scheduled + live plan.
	it('offers no undo on a row that is not scheduled to cancel', async () => {
		arrange(makeSub());
		renderDrawer();

		await screen.findByText('ada@example.com');
		expect(screen.queryByRole('button', { name: 'Undo cancellation' })).not.toBeInTheDocument();
	});

	it('offers no undo once the plan has been archived', async () => {
		const sub = makeSub({ cancel_at_period_end: true });
		arrange({ ...sub, plan: { ...sub.plan, is_active: false } } as SubscriptionSchema);
		renderDrawer();

		await screen.findByText(/Cancels on/i);
		expect(screen.queryByRole('button', { name: 'Undo cancellation' })).not.toBeInTheDocument();
	});

	// One click, deliberately unconfirmed: it restores the state the row was in
	// before the cancellation was scheduled, and Cancel is the undo.
	it('clears the scheduled cancellation on the first click', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ cancel_at_period_end: true }));
		vi.mocked(organizationadminsubscriptionsUncancelSubscription).mockResolvedValue({
			data: makeSub({ cancel_at_period_end: false }),
			error: undefined,
			response: { ok: true } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsUncancelSubscription>>);
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Undo cancellation' }));

		await waitFor(() => {
			expect(organizationadminsubscriptionsUncancelSubscription).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'test-org', sub_id: 'sub-1' } })
			);
		});
		// The button disappears with the state it gated, so the toast is the only
		// confirmation staff get.
		await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Renewal restored.'));
	});

	// 502: Stripe refused and the cancellation is still scheduled, so the retryable
	// detail has to reach the operator verbatim.
	it('surfaces the backend detail when the undo fails', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ cancel_at_period_end: true }));
		vi.mocked(organizationadminsubscriptionsUncancelSubscription).mockResolvedValue({
			data: undefined,
			error: { detail: 'Payment processing failed. Please try again later.' },
			response: { ok: false } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsUncancelSubscription>>);
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Undo cancellation' }));

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				'Payment processing failed. Please try again later.'
			)
		);
	});

	/**
	 * Guard 4 (`_assert_membership_allows_renewal`), pre-gated. `member_status` is a
	 * queryset annotation carrying the *member row's* status, so the drawer can
	 * withhold a button that could only 403 — the one state guards 1–3 wave through
	 * (`_mirror_status_to_subscriptions` skips a row already scheduled to cancel, so
	 * a staff PAUSE leaves the member PAUSED while the subscription stays ACTIVE).
	 */
	it.each(['paused', 'banned'] as const)(
		'withholds the undo when the member row is %s',
		async (memberStatus) => {
			arrange(makeSub({ cancel_at_period_end: true, member_status: memberStatus }));
			renderDrawer();

			await screen.findByText(/Cancels on/i);
			expect(screen.queryByRole('button', { name: 'Undo cancellation' })).not.toBeInTheDocument();
		}
	);

	// `null` is the backend's "no member row exists", which is not "active" — it
	// means the drawer cannot pre-gate, so the server decides. Neither it nor an
	// absent annotation may hide the button.
	it.each([
		['active', 'active' as const],
		['null', null],
		['absent', undefined]
	])('keeps the undo when the member status is %s', async (_label, memberStatus) => {
		arrange(makeSub({ cancel_at_period_end: true, member_status: memberStatus }));
		renderDrawer();

		expect(await screen.findByRole('button', { name: 'Undo cancellation' })).toBeInTheDocument();
	});

	/**
	 * 403 (`_assert_membership_allows_renewal`). Pre-gating does not make this
	 * unreachable — the member row can be suspended between load and click, and
	 * `member_status` may be absent — and the backend's staff copy is now written
	 * for this reader ("Restore the member…"), so it is passed through verbatim.
	 */
	it('surfaces the backend 403 detail verbatim when the pre-gate is outrun', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ cancel_at_period_end: true }));
		vi.mocked(organizationadminsubscriptionsUncancelSubscription).mockResolvedValue({
			data: undefined,
			error: {
				detail: 'This membership is suspended. Restore the member before resuming renewals.'
			},
			response: { ok: false, status: 403 } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsUncancelSubscription>>);
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Undo cancellation' }));

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				'This membership is suspended. Restore the member before resuming renewals.'
			)
		);
	});
});

describe('SubscriptionDrawer pause confirmation', () => {
	it('asks for confirmation instead of pausing on the first click', async () => {
		const user = userEvent.setup();
		arrange(makeSub());
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Pause' }));

		expect(
			await screen.findByRole('dialog', { name: 'Pause this subscription?' })
		).toBeInTheDocument();
		expect(screen.getByText(/loses members-only access until you resume/i)).toBeInTheDocument();
		expect(organizationadminsubscriptionsPauseSubscription).not.toHaveBeenCalled();
	});

	it('pauses only once the confirmation CTA is pressed', async () => {
		const user = userEvent.setup();
		arrange(makeSub());
		vi.mocked(organizationadminsubscriptionsPauseSubscription).mockResolvedValue({
			data: makeSub({ status: 'paused' }),
			error: undefined,
			response: { ok: true } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsPauseSubscription>>);
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Pause' }));
		await user.click(await screen.findByRole('button', { name: 'Pause subscription' }));

		await waitFor(() => {
			expect(organizationadminsubscriptionsPauseSubscription).toHaveBeenCalledTimes(1);
		});
	});

	it('leaves the subscription running when the confirmation is dismissed', async () => {
		const user = userEvent.setup();
		arrange(makeSub());
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Pause' }));
		await user.click(await screen.findByRole('button', { name: "Don't pause" }));

		await waitFor(() => {
			expect(
				screen.queryByRole('dialog', { name: 'Pause this subscription?' })
			).not.toBeInTheDocument();
		});
		expect(organizationadminsubscriptionsPauseSubscription).not.toHaveBeenCalled();
	});

	it('warns that a scheduled plan change is dropped only when one is pending', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ pending_plan_id: 'plan-2' }));
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Pause' }));
		expect(await screen.findByText(/scheduled plan change is dropped/i)).toBeInTheDocument();
	});

	it('omits the scheduled-plan-change warning when nothing is pending', async () => {
		const user = userEvent.setup();
		arrange(makeSub());
		renderDrawer();

		await user.click(await screen.findByRole('button', { name: 'Pause' }));
		// Anchor on the always-present sentence so the negative below cannot pass
		// merely because the dialog has not rendered yet.
		await screen.findByText(/loses members-only access until you resume/i);
		expect(screen.queryByText(/scheduled plan change is dropped/i)).not.toBeInTheDocument();
	});
});

describe('SubscriptionDrawer cancel', () => {
	/** Open the cancel dialog and confirm an immediate cancellation. */
	async function cancelImmediately(user: ReturnType<typeof userEvent.setup>) {
		await user.click(await screen.findByRole('button', { name: 'Cancel' }));
		await user.click(await screen.findByRole('radio', { name: /Immediately/ }));
		await user.click(
			await screen.findByRole('checkbox', { name: /access is revoked immediately/i })
		);
		await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));
	}

	function mockCancel(result: Record<string, unknown>) {
		vi.mocked(organizationadminsubscriptionsCancelSubscription).mockResolvedValue(
			result as unknown as Awaited<
				ReturnType<typeof organizationadminsubscriptionsCancelSubscription>
			>
		);
	}

	it('reports a plain cancellation without a toast', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ plan: { ...makeSub().plan, payment_method: 'online' } }));
		mockCancel({
			data: makeSub({ status: 'cancelled' }),
			error: undefined,
			response: { ok: true } as unknown as Response
		});
		renderDrawer();

		await cancelImmediately(user);

		await waitFor(() =>
			expect(organizationadminsubscriptionsCancelSubscription).toHaveBeenCalledWith(
				expect.objectContaining({ body: { immediate: true } })
			)
		);
		expect(toastErrorMock).not.toHaveBeenCalled();
		expect(toastInfoMock).not.toHaveBeenCalled();
	});

	/**
	 * 409 `subscription_activation_pending`: the member completed the hosted
	 * Checkout while the backend was expiring it, so the money moved, the
	 * activation webhooks are in flight and the cancellation was aborted. Staff
	 * must learn that the row is about to go ACTIVE — not that their cancel broke.
	 */
	it('tells staff the member paid and the row will activate, not that it failed', async () => {
		const user = userEvent.setup();
		arrange(
			makeSub({
				status: 'pending',
				stripe_checkout_session_id: 'cs_test_1',
				plan: { ...makeSub().plan, payment_method: 'online' }
			})
		);
		mockCancel({
			data: undefined,
			error: {
				detail: "Your payment went through. We're still confirming your subscription.",
				code: 'subscription_activation_pending'
			},
			response: { ok: false, status: 409 } as unknown as Response
		});
		renderDrawer();

		await cancelImmediately(user);

		await waitFor(() =>
			expect(toastInfoMock).toHaveBeenCalledWith(
				"This member's payment went through, so the subscription wasn't cancelled — it's being activated right now. Cancel it again once it's active."
			)
		);
		// Not an error, so it must never reach the red channel.
		expect(toastErrorMock).not.toHaveBeenCalled();
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});

	// 502: Stripe unreachable, cancel aborted, row untouched. The backend's own
	// detail reads like a charge failed, which is the opposite of what happened.
	it('replaces the 502 detail with a "nothing changed, retry" message', async () => {
		const user = userEvent.setup();
		arrange(makeSub({ plan: { ...makeSub().plan, payment_method: 'online' } }));
		mockCancel({
			data: undefined,
			error: { detail: 'Payment processing failed. Please try again later.' },
			response: { ok: false, status: 502 } as unknown as Response
		});
		renderDrawer();

		await cancelImmediately(user);

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				"Couldn't reach the payment provider, so nothing changed — this subscription is exactly as it was. Try again in a moment."
			)
		);
		expect(toastErrorMock).not.toHaveBeenCalledWith(
			expect.stringContaining('Payment processing failed')
		);
		expect(toastInfoMock).not.toHaveBeenCalled();
	});

	// The pre-existing path: any other refusal still shows the backend's detail.
	it('still passes a 400 detail through verbatim', async () => {
		const user = userEvent.setup();
		arrange(makeSub());
		mockCancel({
			data: undefined,
			error: { detail: 'Cannot schedule cancellation for a paused subscription.' },
			response: { ok: false, status: 400 } as unknown as Response
		});
		renderDrawer();

		await cancelImmediately(user);

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				'Cannot schedule cancellation for a paused subscription.'
			)
		);
		expect(toastInfoMock).not.toHaveBeenCalled();
	});
});

describe('SubscriptionDrawer refund gating', () => {
	it('hides the per-payment Refund control on an ONLINE plan', async () => {
		arrange(makeSub({ plan: { ...makeSub().plan, payment_method: 'online' } }), [
			makePayment({
				stripe_dashboard_url: 'https://dashboard.stripe.com/test/payments/pi_1'
			})
		]);
		renderDrawer();

		await screen.findByRole('link', { name: 'View on Stripe' });
		expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
	});

	it('keeps the per-payment Refund control on an OFFLINE plan', async () => {
		arrange(makeSub(), [makePayment()]);
		renderDrawer();

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
		});
		expect(screen.queryByText('View on Stripe')).not.toBeInTheDocument();
	});
});
