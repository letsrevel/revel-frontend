import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import MembershipCard from './MembershipCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MesubscriptionsSubscribeB7F76Ea8Errors,
	MyMembershipSchema,
	MySubscriptionSchema,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';
import { formatDate } from '$lib/utils/date';

// The card mounts both action dialogs unconditionally, so every SDK function
// they import has to exist on the mocked module or the import itself throws.
const portalMock = vi.hoisted(() => vi.fn());
const plansMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const uncancelMock = vi.hoisted(() => vi.fn());
const paymentsMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsCreateBillingPortalSession: portalMock,
	organizationListMembershipPlans: plansMock,
	mesubscriptionsSubscribe: subscribeMock,
	mesubscriptionsUncancelSubscription: uncancelMock,
	mesubscriptionsListMySubscriptionPayments: paymentsMock,
	mesubscriptionsCancelSubscription: vi.fn(),
	mesubscriptionsChangePlan: vi.fn(),
	organizationGetOrganization: vi.fn()
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({
	toast: { error: toastErrorMock, success: toastSuccessMock }
}));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const PERIOD_END = '2026-09-01T00:00:00Z';
const GRACE_DEADLINE = '2026-09-08T00:00:00Z';
const PAGE_URL = 'http://localhost/account/memberships';

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 's1',
		plan_id: 'p1',
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
		status: 'active',
		current_period_start: '2026-08-01T00:00:00Z',
		current_period_end: PERIOD_END,
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		grace_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-08-01T00:00:00Z',
		updated_at: '2026-08-01T00:00:00Z',
		plan: {
			id: 'p1',
			tier_id: 't1',
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

function makeOfflineSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	const sub = makeSub(overrides);
	return { ...sub, plan: { ...sub.plan, payment_method: 'offline' } };
}

function makeMembership(
	sub: MySubscriptionSchema | null,
	status: MyMembershipSchema['status'] = 'active'
): MyMembershipSchema {
	return {
		organization_id: 'org-1',
		organization_name: 'Test Org',
		organization_slug: 'test-org',
		organization_logo_url: null,
		member_since: '2026-08-01T00:00:00Z',
		status,
		tier: null,
		subscription: sub
	};
}

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
	return {
		id: 'p2',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Yearly',
		description: null,
		price: '100.00',
		currency: 'EUR',
		period_unit: 'year',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false,
		...overrides
	};
}

describe('MembershipCard', () => {
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
			value: { href: PAGE_URL } as Location
		});
		plansMock.mockResolvedValue({ data: [makePlan()], error: undefined });
		paymentsMock.mockResolvedValue({
			data: { count: 0, next: null, previous: null, results: [] },
			error: undefined
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
	});

	function renderCard(membership: MyMembershipSchema) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: MembershipCard, componentProps: { membership } }
		});
	}

	it('offers all three self-serve actions on an online active subscription', () => {
		renderCard(makeMembership(makeSub()));

		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /change plan/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel membership/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /view org/i })).toBeInTheDocument();
	});

	it('offers no self-serve actions on an offline subscription and says who manages it', () => {
		renderCard(makeMembership(makeOfflineSub()));

		expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
		expect(
			screen.getByText('Managed by Test Org — contact them to make changes.')
		).toBeInTheDocument();
	});

	it('raises a dated past-due alert for an online subscription', () => {
		renderCard(makeMembership(makeSub({ status: 'past_due', grace_deadline: GRACE_DEADLINE })));

		expect(screen.getByRole('alert')).toHaveTextContent(
			`update your payment method by ${formatDate(GRACE_DEADLINE)}`
		);
		// Self-serve members fix this in the portal, not by emailing the organizer.
		expect(screen.queryByText(/reach out to the organizer/i)).toBeNull();
		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
	});

	it('falls back to an undated past-due alert when no grace deadline is known', () => {
		renderCard(makeMembership(makeSub({ status: 'past_due' })));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Payment failed — update your payment method to keep your membership.'
		);
	});

	it('points an offline past-due member at the organizer instead of a portal', () => {
		renderCard(makeMembership(makeOfflineSub({ status: 'past_due' })));

		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByText(/reach out to the organizer/i)).toBeInTheDocument();
	});

	// Pause is admin-only on the backend and propagates to the member row, so it
	// silently costs members-only access with nothing on this card to undo it.
	it('explains an admin-imposed pause and points at the organization', () => {
		renderCard(makeMembership(makeSub({ status: 'paused' })));

		expect(
			screen.getByText('Paused by the organization — contact them to resume.')
		).toBeInTheDocument();
		// Informational, not an alarm — and never the only signal (the status badge
		// carries it too), so nothing here is encoded in colour alone.
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
	});

	// Neither payment method lets the member resume themselves.
	it('explains the pause on an offline subscription too', () => {
		renderCard(makeMembership(makeOfflineSub({ status: 'paused' })));

		expect(
			screen.getByText('Paused by the organization — contact them to resume.')
		).toBeInTheDocument();
	});

	it('shows no pause hint on an active subscription', () => {
		renderCard(makeMembership(makeSub()));

		expect(screen.queryByText(/paused by the organization/i)).toBeNull();
	});

	it('offers billing management and the way back once cancellation is scheduled', () => {
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true })));

		expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Resume renewal' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /cancel membership/i })).toBeNull();
		// The hint points at the button next to it — it must never send a member who
		// can fix this themselves off to email the organization (#808).
		expect(
			screen.getByText(
				'Renewal is off. Resume it any time before this date to keep your membership.'
			)
		).toBeInTheDocument();
		expect(screen.queryByText(/contact the organization/i)).toBeNull();
	});

	// No self-serve undo exists here, so the old "ask the organization" wording is
	// still the truthful one.
	it('keeps the contact-the-organization hint on a staff-run offline subscription', () => {
		renderCard(makeMembership(makeOfflineSub({ cancel_at_period_end: true })));

		expect(screen.queryByRole('button', { name: 'Resume renewal' })).toBeNull();
		expect(
			screen.getByText('Renewal is off. To keep your membership, contact the organization.')
		).toBeInTheDocument();
	});

	// `uncancel_subscription` refuses an archived plan with a 400, so the button
	// would only ever fail.
	it('withdraws the resume button when the plan has been archived', () => {
		const sub = makeSub({ cancel_at_period_end: true });
		sub.plan = { ...sub.plan, is_active: false };
		renderCard(makeMembership(sub));

		expect(screen.queryByRole('button', { name: 'Resume renewal' })).toBeNull();
		expect(
			screen.getByText('Renewal is off. To keep your membership, contact the organization.')
		).toBeInTheDocument();
	});

	// One click, no confirmation: restoring a renewal costs nothing today and is
	// itself undone by the Cancel membership dialog.
	it('resumes renewal without a confirmation step and settles the caches', async () => {
		const user = userEvent.setup();
		const resumed = makeSub({ cancel_at_period_end: false });
		uncancelMock.mockResolvedValue({ data: resumed, error: undefined });
		queryClient.setQueryData(['me', 'subscriptions'], [makeSub({ cancel_at_period_end: true })]);
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true })));

		await user.click(screen.getByRole('button', { name: 'Resume renewal' }));

		await waitFor(() =>
			expect(uncancelMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { org_id: 'org-1' } })
			)
		);
		// The 200 body is written straight into the member-facing caches, so a
		// webhook echo landing later cannot flip the card back to "Cancels on …".
		await waitFor(() =>
			expect(queryClient.getQueryData(['me', 'subscriptions'])).toEqual([resumed])
		);
		expect(toastSuccessMock).toHaveBeenCalledWith('Renewal is back on.');
	});

	// A 502 leaves the cancellation scheduled on both sides — the member has to be
	// told, not left looking at an unchanged card.
	it('surfaces the backend detail when resuming renewal fails', async () => {
		const user = userEvent.setup();
		uncancelMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'Payment processing failed. Please try again later.' }
		});
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true })));

		await user.click(screen.getByRole('button', { name: 'Resume renewal' }));

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				'Payment processing failed. Please try again later.'
			)
		);
	});

	it('sends the member to the Stripe billing portal and back to this page', async () => {
		const user = userEvent.setup();
		portalMock.mockResolvedValue({
			data: { url: 'https://billing.stripe.test/session/abc' },
			error: undefined
		});
		renderCard(makeMembership(makeSub()));

		await user.click(screen.getByRole('button', { name: /manage billing/i }));

		await waitFor(() =>
			expect(portalMock).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { org_id: 'org-1' },
					body: { return_url: PAGE_URL }
				})
			)
		);
		await waitFor(() =>
			expect(window.location.href).toBe('https://billing.stripe.test/session/abc')
		);
		// Latched and ANNOUNCED, in parity with the resume/uncancel buttons (#702):
		// `disabled` alone stops a second click but tells an assistive-technology
		// user nothing about why the control went dead mid-navigation.
		await waitFor(() => {
			const btn = screen.getByRole('button', { name: /manage billing/i });
			expect(btn).toBeDisabled();
			expect(btn).toHaveAttribute('aria-busy', 'true');
		});
	});

	it('names the queued plan from the org plan catalogue when a switch is pending', async () => {
		renderCard(makeMembership(makeSub({ pending_plan_id: 'p2' })));

		expect(
			await screen.findByText(`Switching to Yearly on ${formatDate(PERIOD_END)}`)
		).toBeInTheDocument();
		await waitFor(() =>
			expect(plansMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'test-org' } })
			)
		);
		// The backend rejects a second change while one is queued.
		expect(screen.queryByRole('button', { name: /change plan/i })).toBeNull();
	});

	it('does not fetch the plan catalogue when nothing is queued', async () => {
		renderCard(makeMembership(makeSub()));

		await waitFor(() =>
			expect(screen.getByRole('button', { name: /manage billing/i })).toBeVisible()
		);
		expect(plansMock).not.toHaveBeenCalled();
	});

	// #694 — an abandoned Checkout leaves the row PENDING; without this action the
	// card is a dead end (no path back to the still-open Stripe session).
	it('resumes an abandoned checkout from a pending online subscription', async () => {
		const user = userEvent.setup();
		subscribeMock.mockResolvedValue({
			data: {
				subscription: makeSub({ status: 'pending' }),
				checkout_url: 'https://stripe.test/cs'
			},
			error: undefined
		});
		renderCard(makeMembership(makeSub({ status: 'pending' })));

		await user.click(screen.getByRole('button', { name: /resume payment/i }));

		// The row's OWN plan: the backend hands back the still-open session for the
		// same plan (`_maybe_resume_pending_checkout`).
		await waitFor(() =>
			expect(subscribeMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { org_id: 'org-1' }, body: { plan_id: 'p1' } })
			)
		);
		await waitFor(() => expect(window.location.href).toBe('https://stripe.test/cs'));
		// Latched: the document is on its way out, so the CTA must not invite a
		// second click.
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /resume payment/i })).toBeDisabled()
		);
	});

	/**
	 * The error body is pinned to the endpoint's OWN generated error type rather
	 * than written as a free-form object.
	 *
	 * #702 asked for `ResponseMessage {message}` here, but that would be a
	 * fiction: since backend PR #824 the OpenAPI error declarations are honest,
	 * and `MesubscriptionsSubscribeB7F76Ea8Errors` declares `ErrorDetail`
	 * (`{ detail }`) for 400/404/502 — `{ message }` survives on exactly two
	 * claim-invitation endpoints, of which this is neither. Mocking a shape the
	 * backend cannot send would make the test prove something untrue. The typed
	 * binding below is what keeps it honest from here on: if the declaration ever
	 * does change, this stops compiling instead of quietly asserting a dead path.
	 */
	it('toasts the backend detail when the resume fails and stays on the page', async () => {
		const user = userEvent.setup();
		const expiredSession: MesubscriptionsSubscribeB7F76Ea8Errors[400] = {
			detail: 'That checkout session has expired.'
		};
		subscribeMock.mockResolvedValue({ data: undefined, error: expiredSession });
		renderCard(makeMembership(makeSub({ status: 'pending' })));

		await user.click(screen.getByRole('button', { name: /resume payment/i }));

		await waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith('That checkout session has expired.')
		);
		expect(window.location.href).toBe(PAGE_URL);
	});

	// Staff record these payments by hand — there is no Checkout session to resume.
	it('offers no resume on a pending offline subscription', () => {
		renderCard(makeMembership(makeOfflineSub({ status: 'pending' })));

		expect(screen.queryByRole('button', { name: /resume payment/i })).toBeNull();
		expect(
			screen.getByText('Managed by Test Org — contact them to make changes.')
		).toBeInTheDocument();
	});

	/**
	 * The reachable 403 (#808 follow-up): staff PAUSE a member whose subscription
	 * was already scheduled to cancel, `_mirror_status_to_subscriptions` skips it,
	 * and the row stays ACTIVE while the member row is PAUSED. Every guard the card
	 * used to check passes, so the button rendered and the click was a guaranteed
	 * `_assert_membership_allows_renewal` refusal.
	 */
	it('withdraws the resume button and says why when the membership is suspended', () => {
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true }), 'paused'));

		expect(screen.queryByRole('button', { name: 'Resume renewal' })).toBeNull();
		expect(
			screen.getByText(
				'Your membership is suspended. The organizers have to restore it before your renewal can start again.'
			)
		).toBeInTheDocument();
		// Informational, not an alarm — the member cannot act on it beyond asking.
		expect(screen.queryByRole('alert')).toBeNull();
	});

	// The subscription itself carries the pause here, so `pausedHint` already says
	// it — a second notice saying the same thing is noise.
	it('does not double up on the notice when the subscription mirrors the pause', () => {
		renderCard(makeMembership(makeSub({ status: 'paused' }), 'paused'));

		expect(
			screen.getByText('Paused by the organization — contact them to resume.')
		).toBeInTheDocument();
		expect(screen.queryByText(/Your membership is suspended/)).toBeNull();
	});

	it('shows no suspension notice for an active membership', () => {
		renderCard(makeMembership(makeSub({ cancel_at_period_end: true })));

		expect(screen.queryByText(/Your membership is suspended/)).toBeNull();
		expect(screen.getByRole('button', { name: 'Resume renewal' })).toBeInTheDocument();
	});

	/**
	 * One card renders per membership on the account hub, so an eager payments
	 * query here would be an N+1 across the whole list.
	 */
	it('offers the payment history collapsed and does not fetch it until opened', async () => {
		const user = userEvent.setup();
		renderCard(makeMembership(makeSub()));

		const toggle = screen.getByRole('button', { name: /payment history/i });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(paymentsMock).not.toHaveBeenCalled();

		await user.click(toggle);

		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await waitFor(() =>
			expect(paymentsMock).toHaveBeenCalledWith(
				expect.objectContaining({ path: { org_id: 'org-1' } })
			)
		);
	});

	// The endpoint is org-scoped and covers subscriptions that have since ended, so
	// the history has to outlive the subscription it was paid for.
	it('still offers the payment history when there is no live subscription', () => {
		renderCard(makeMembership(null));

		expect(screen.getByRole('button', { name: /payment history/i })).toBeInTheDocument();
	});

	it('still shows the plain member-since line when there is no subscription', () => {
		renderCard(makeMembership(null));

		expect(screen.getByText(/member since/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
	});
});
