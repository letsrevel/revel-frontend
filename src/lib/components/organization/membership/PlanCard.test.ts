import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import PlanCard from './PlanCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
import { NO_PLAN_VIEWER, type PlanViewer } from '$lib/utils/plan-cta-state';
import * as m from '$lib/paraglide/messages.js';

const pageUrl = vi.hoisted(() => ({ search: '' }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(`http://localhost/org/acme/membership${pageUrl.search}`);
		}
	}
}));

// The offline branch mounts OrgContactButton, which reads the token for its
// contact-form mutation.
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

/**
 * The per-org endpoint only ever returns a *non-terminal* row, so every
 * subscription a card can be handed is one the backend would refuse to
 * duplicate. A member whose subscription is cancelled or expired simply arrives
 * with `subscription: null` — which is what `makeSub` deliberately cannot model.
 */
function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		status: 'active',
		current_period_start: '2026-07-01T00:00:00Z',
		current_period_end: '2026-08-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
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
			sales_status: 'open'
		},
		...overrides
	};
}

let queryClient: QueryClient;

/**
 * Wrapped in a real QueryClientProvider: the offline branch mounts
 * `OrgContactButton`, whose contact-form mutation resolves its client from
 * Svelte context.
 */
function renderCard(props: Record<string, unknown> = {}) {
	const onSubscribe = vi.fn();
	const onApply = vi.fn();
	const result = render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: PlanCard,
			componentProps: {
				plan: makePlan(),
				isAuthenticated: true,
				onSubscribe,
				onApply,
				organizationSlug: 'acme',
				organizationName: 'Acme',
				...props
			}
		}
	});
	return { ...result, onSubscribe, onApply };
}

describe('PlanCard', () => {
	beforeEach(() => {
		pageUrl.search = '';
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
	});

	// A member with no subscription row (owner-added, imported, open-ended) still
	// cannot join: the backend refuses `already_member`.
	describe('a viewer with standing but no subscription', () => {
		const activeGold: PlanViewer = {
			...NO_PLAN_VIEWER,
			isMember: true,
			membershipStatus: 'active',
			membershipTierId: 'tier-1'
		};

		it('shows a current-tier state and a manage link on a FREE plan of their own tier', () => {
			renderCard({
				viewer: activeGold,
				plan: makePlan({ payment_method: 'free', price: '0.00' })
			});

			expect(screen.queryByRole('button')).not.toBeInTheDocument();
			expect(screen.getByText(m['membershipPlanCta.currentTier']())).toBeInTheDocument();
			expect(
				screen.getByRole('link', {
					name: m['membershipPlanCta.manageLinkAria']({ plan: 'Monthly' })
				})
			).toHaveAttribute('href', '/account/memberships');
		});

		it('keeps the sold-out state next to the current-tier badge on a sold-out PAID plan', () => {
			renderCard({ viewer: activeGold, plan: makePlan({ sold_out: true }) });

			expect(screen.getByText(m['membershipPlanCta.currentTier']())).toBeInTheDocument();
			expect(screen.getByText(m['membershipPlans.soldOut']())).toBeInTheDocument();
			expect(screen.getByText(m['membershipPlans.soldOutHelper']())).toBeInTheDocument();
			expect(screen.queryByRole('button')).not.toBeInTheDocument();
		});

		it('shows the current-tier badge AND keeps Subscribe on a PAID plan of their own tier', () => {
			renderCard({ viewer: activeGold });

			expect(screen.getByText(m['membershipPlanCta.currentTier']())).toBeInTheDocument();
			expect(
				screen.getByRole('button', { name: m['membershipPlans.subscribeCta']() })
			).toBeInTheDocument();
		});

		it('does not flash the own-tier state while the subscription is loading', () => {
			renderCard({ viewer: activeGold, subscriptionLoading: true });

			expect(screen.queryByText(m['membershipPlanCta.currentTier']())).not.toBeInTheDocument();
		});

		it('shows a note and no CTA to a paused or banned member', () => {
			for (const [status, key] of [
				['paused', 'membershipPlanCta.pausedNote'],
				['banned', 'membershipPlanCta.bannedNote']
			] as const) {
				const { unmount } = renderCard({ viewer: { ...activeGold, membershipStatus: status } });
				expect(screen.queryByRole('button')).not.toBeInTheDocument();
				expect(screen.getByText(m[key]())).toBeInTheDocument();
				unmount();
			}
		});

		it('shows no join control on a FREE plan of another tier', () => {
			renderCard({
				viewer: activeGold,
				plan: makePlan({ tier_id: 'tier-2', payment_method: 'free', price: '0.00' })
			});

			expect(screen.queryByRole('button')).not.toBeInTheDocument();
			expect(screen.getByText(m['membershipPlanCta.freeOtherTierHelper']())).toBeInTheDocument();
		});

		it('keeps the CTA on a PAID plan of another tier (tier change)', () => {
			renderCard({ viewer: activeGold, plan: makePlan({ tier_id: 'tier-2' }) });

			expect(
				screen.getByRole('button', { name: m['membershipPlans.subscribeCta']() })
			).toBeInTheDocument();
		});

		it('never offers Join to the owner', () => {
			renderCard({ viewer: { ...NO_PLAN_VIEWER, isOwner: true } });
			expect(screen.queryByRole('button')).not.toBeInTheDocument();
			// The page summary says it once; the card stays silent.
			expect(screen.queryByText(m['membershipPlanCta.ownerNote']())).toBeNull();
		});

		it('lets an existing subscription keep driving the card', () => {
			renderCard({ viewer: activeGold, subscription: makeSub() });

			expect(screen.getByText(m['membershipPlans.yourPlan']())).toBeInTheDocument();
			expect(screen.queryByText(m['membershipPlanCta.currentTier']())).not.toBeInTheDocument();
		});

		it('offers Join to a non-member', () => {
			renderCard();

			expect(
				screen.getByRole('button', { name: m['membershipPlans.subscribeCta']() })
			).toBeInTheDocument();
		});

		it('sends a guest to log in', () => {
			renderCard({ isAuthenticated: false });

			expect(
				screen.getByRole('link', { name: m['membershipPlans.loginToSubscribe']() })
			).toBeInTheDocument();
		});
	});

	it('shows the plan name, price and description', () => {
		renderCard({ plan: makePlan({ description: 'Two lines\nof perks' }) });

		expect(screen.getByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
		expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
		expect(screen.getByText(/two lines/i)).toBeInTheDocument();
	});

	// An OFFLINE plan is paid to the organizers directly, but joining it is still
	// self-serve: the gate drives Join/Apply like any other plan, and the member
	// is held as awaiting payment until staff record it.
	describe('an offline plan', () => {
		const offlinePlan = () => makePlan({ payment_method: 'offline' });
		const awaitingSub = (overrides: Partial<MySubscriptionSchema> = {}) =>
			makeSub({
				status: 'pending',
				plan: { ...makeSub().plan, payment_method: 'offline' },
				...overrides
			});

		it('offers Join, not Subscribe, when no approval stands in the way', async () => {
			const user = userEvent.setup();
			const { onSubscribe } = renderCard({ plan: offlinePlan() });

			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			await user.click(screen.getByRole('button', { name: m['membershipPlans.joinCta']() }));

			expect(onSubscribe).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }));
		});

		it('tells a logged-in user the plan is paid directly to the org', () => {
			renderCard({ plan: offlinePlan() });

			expect(
				screen.getByText(m['membershipPlans.offlineGuestNote']({ orgName: 'Acme' }))
			).toBeInTheDocument();
		});

		it('words the blocked-gate note as joining, not subscribing', () => {
			renderCard({ plan: offlinePlan(), gateAction: 'blocked' });

			expect(
				screen.getByText(m['membershipPlans.gatedJoinHelper'](), { exact: false })
			).toBeInTheDocument();
			expect(screen.queryByText(m['membershipPlans.gatedSubscribeHelper']())).toBeNull();
		});

		it('offers Apply when the tier needs approval', async () => {
			const user = userEvent.setup();
			const { onApply } = renderCard({ plan: offlinePlan(), gateAction: 'apply' });

			await user.click(
				screen.getByRole('button', { name: m['membershipPlans.applyCtaAria']({ plan: 'Monthly' }) })
			);

			expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }), 'join');
			expect(
				screen.getByText(m['membershipPlans.applyOfflineHelper']({ orgName: 'Acme' }))
			).toBeInTheDocument();
		});

		it('tells a guest the plan is paid directly, behind a login link', () => {
			renderCard({ plan: offlinePlan(), isAuthenticated: false });

			expect(
				screen.getByText(m['membershipPlans.offlineGuestNote']({ orgName: 'Acme' }))
			).toBeInTheDocument();
			expect(screen.getByRole('link', { name: /log in to join/i })).toBeInTheDocument();
		});

		it('keeps the page returnUrl nested in the guest login link', () => {
			pageUrl.search = `?returnUrl=${encodeURIComponent('/events/acme/gala')}`;
			renderCard({ plan: offlinePlan(), isAuthenticated: false });

			const link = screen.getByRole('link', { name: /log in to join/i });
			expect(link).toHaveAttribute(
				'href',
				`/login?returnUrl=${encodeURIComponent(
					`/org/acme/membership?returnUrl=${encodeURIComponent('/events/acme/gala')}`
				)}`
			);
		});

		it('drops an unsafe page returnUrl from the guest login link', () => {
			pageUrl.search = `?returnUrl=${encodeURIComponent('//evil.com')}`;
			renderCard({ plan: offlinePlan(), isAuthenticated: false });

			expect(screen.getByRole('link', { name: /log in to join/i })).toHaveAttribute(
				'href',
				'/login?returnUrl=%2Forg%2Facme%2Fmembership'
			);
		});

		it('shows an awaiting-payment block for a pending offline subscription on this plan', () => {
			renderCard({ plan: offlinePlan(), subscription: awaitingSub() });

			expect(
				screen.getByText(m['membershipPlans.awaitingPaymentHelper']({ orgName: 'Acme' }))
			).toBeInTheDocument();
			expect(
				screen.getByRole('link', { name: m['membershipEligibility.seePaymentDetails']() })
			).toHaveAttribute('href', '/account/memberships');
			// Not the member's live plan yet, and no Stripe resume copy.
			expect(screen.queryByText(m['membershipPlans.yourPlan']())).toBeNull();
			expect(screen.queryByText(m['membershipPlans.yourPlanHelper']())).toBeNull();
			expect(screen.queryByText(m['membershipPlans.pendingCheckoutHelper']())).toBeNull();
			expect(screen.queryByRole('button')).toBeNull();
		});

		it('keeps "Your plan" and the resume-checkout helper for a pending ONLINE subscription', () => {
			renderCard({ subscription: makeSub({ plan_id: 'plan-1', status: 'pending' }) });

			expect(screen.getByText(m['membershipPlans.yourPlan']())).toBeInTheDocument();
			expect(screen.getByText(m['membershipPlans.pendingCheckoutHelper']())).toBeInTheDocument();
			expect(
				screen.queryByText(m['membershipPlans.awaitingPaymentHelper']({ orgName: 'Acme' }))
			).toBeNull();
		});

		it('gives the other plans neutral copy and no change-plan link while awaiting', () => {
			renderCard({
				plan: makePlan({ id: 'plan-2', name: 'Yearly' }),
				subscription: awaitingSub()
			});

			expect(
				screen.getByText(m['membershipPlans.awaitingOtherPlanHelper']({ orgName: 'Acme' }))
			).toBeInTheDocument();
			expect(screen.queryByText(m['membershipPlans.alreadySubscribed']())).toBeNull();
			expect(screen.queryByRole('link')).toBeNull();
		});
	});

	it('labels a sold-out plan in text and withdraws the CTA', () => {
		renderCard({ plan: makePlan({ sold_out: true }) });

		expect(screen.getByText('Sold out')).toBeInTheDocument();
		expect(screen.getByText(/all spots are taken/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('labels a paused plan in text and withdraws the CTA', () => {
		renderCard({ plan: makePlan({ sales_status: 'paused' }) });

		expect(screen.getByText('Sales paused')).toBeInTheDocument();
		expect(screen.getByText(/temporarily closed sign-ups/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('hands the plan to the caller when a signed-in member subscribes', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard();

		await user.click(screen.getByRole('button', { name: /subscribe/i }));

		expect(onSubscribe).toHaveBeenCalledTimes(1);
		expect(onSubscribe).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }));
	});

	// A real anchor, not a scripted redirect: it survives no-JS and middle-click.
	it('sends a guest to the login page with a return URL back to the tier grid', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: /log in to subscribe/i });
		expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme%2Fmembership');
		expect(screen.queryByRole('button')).toBeNull();

		await user.click(link);
		expect(onSubscribe).not.toHaveBeenCalled();
	});

	// `id` is null for plans the backend will not accept a subscription for;
	// offering a CTA would only produce a failed checkout.
	it('renders no CTA for a plan without a server-side id', () => {
		renderCard({ plan: makePlan({ id: null }) });

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	// The backend refuses a second non-terminal subscription with a 400, so a
	// "Subscribe" button on a paying member's own plan could only ever fail —
	// after quoting them a concrete new charge.
	describe('when the viewer already subscribes in this organization', () => {
		it('marks the plan the member is on and offers nothing to press', () => {
			const { onSubscribe } = renderCard({ subscription: makeSub({ plan_id: 'plan-1' }) });

			expect(screen.getByText('Your plan')).toBeInTheDocument();
			expect(screen.getByText(/subscribed to this plan/i)).toBeInTheDocument();
			expect(screen.queryByRole('button')).toBeNull();
			expect(screen.queryByRole('link')).toBeNull();
			expect(onSubscribe).not.toHaveBeenCalled();
		});

		it('withdraws Subscribe from the other plans and explains why', () => {
			renderCard({
				plan: makePlan({ id: 'plan-2', name: 'Annual', price: '100.00' }),
				subscription: makeSub({ plan_id: 'plan-1' })
			});

			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			expect(screen.getByText(/already have a subscription/i)).toBeInTheDocument();
		});

		// The link only navigates to the account hub, where ChangePlanDialog lives;
		// it is offered exactly when that dialog would really list this plan.
		it('links a switchable plan to the account hub, named for screen readers', () => {
			renderCard({
				plan: makePlan({ id: 'plan-2', name: 'Annual', price: '100.00' }),
				subscription: makeSub({ plan_id: 'plan-1' })
			});

			const link = screen.getByRole('link', { name: 'Change plan: switch to Annual' });
			expect(link).toHaveAttribute('href', '/account/memberships');
		});

		// ChangePlanDialog filters to online plans in the subscription's own
		// currency; linking a member to a plan it would never list is a dead end.
		it('offers no change-plan link for a plan the change flow cannot accept', () => {
			renderCard({
				plan: makePlan({ id: 'plan-2', name: 'Annual', currency: 'USD' }),
				subscription: makeSub({ plan_id: 'plan-1' })
			});

			expect(screen.getByText(/already have a subscription/i)).toBeInTheDocument();
			expect(screen.queryByRole('link')).toBeNull();
		});

		// A PENDING row is an unfinished hosted Checkout: neither "you're
		// subscribed" nor a second checkout would be true.
		it('sends an unfinished checkout back to the account hub instead of re-charging', () => {
			renderCard({ subscription: makeSub({ plan_id: 'plan-1', status: 'pending' }) });

			expect(screen.getByText(/payment isn't finished/i)).toBeInTheDocument();
			expect(screen.queryByText(/subscribed to this plan/i)).toBeNull();
			expect(screen.queryByRole('button')).toBeNull();
		});

		// A member on this plan cannot buy it again whatever its sales state, so
		// the viewer-level fact wins over the plan-level one.
		it('marks the plan as theirs even when it is sold out', () => {
			renderCard({
				plan: makePlan({ sold_out: true }),
				subscription: makeSub({ plan_id: 'plan-1' })
			});

			expect(screen.getByText('Your plan')).toBeInTheDocument();
			expect(screen.queryByText('Sold out')).toBeNull();
		});
	});

	// Cancelled and expired rows are excluded by the endpoint itself, so a member
	// whose membership has ended reaches the card with no subscription at all and
	// must be able to join again.
	it('still offers Subscribe when a past subscription has ended', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard({ subscription: null });

		await user.click(screen.getByRole('button', { name: /subscribe/i }));
		expect(onSubscribe).toHaveBeenCalledTimes(1);
	});

	// Until the lookup answers we do not know whether the button would 400, so it
	// keeps its label and its box but cannot be pressed.
	it('holds the Subscribe button while the membership lookup is in flight', () => {
		renderCard({ subscriptionLoading: true });

		expect(screen.getByRole('button', { name: /subscribe/i })).toBeDisabled();
	});

	// #733: since BE #831 a tier can be gated AND priced. `POST …/subscribe` runs
	// the whole eligibility gate stack, so a Subscribe button offered beside "a
	// membership questionnaire is required" can only ever collect a 400 — after
	// quoting the member a concrete charge.
	describe("when the tier's gates are unsatisfied for this viewer", () => {
		it('withdraws Subscribe and explains why, with the price still on the card', () => {
			const { onSubscribe } = renderCard({
				gateAction: 'blocked'
			});

			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			expect(
				screen.getByText(m['membershipPlans.gatedSubscribeHelper'](), { exact: false })
			).toBeInTheDocument();
			// What they are working toward stays visible.
			expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
			expect(onSubscribe).not.toHaveBeenCalled();
		});

		// Not merely adjacent to the reason: the note that replaces the CTA carries
		// it, and points at the tier's full requirement list (WCAG 1.3.1).
		it('associates the withheld CTA with the tier requirements programmatically', () => {
			renderCard({
				gateAction: 'blocked',
				gateRequirementsId: 'tier-1-requirements'
			});

			const note = screen.getByRole('note');
			expect(note).toHaveAttribute('aria-describedby', 'tier-1-requirements');
			expect(note).toHaveTextContent(m['membershipPlans.gatedSubscribeHelper']());
		});

		// Manual approval has the same shape as the questionnaire: apply, be
		// approved, then pay. Nothing to press until the first two happen.
		it('withdraws the free-join CTA too, in join wording', () => {
			renderCard({
				plan: makePlan({ payment_method: 'free', price: '0.00', period_unit: 'lifetime' }),
				gateAction: 'blocked'
			});

			expect(screen.queryByRole('button', { name: /join for free/i })).toBeNull();
			expect(
				screen.getByText(m['membershipPlans.gatedJoinHelper'](), { exact: false })
			).toBeInTheDocument();
			expect(screen.queryByText(m['membershipPlans.gatedSubscribeHelper']())).toBeNull();
		});

		// The crux: "the tier is gated" is not "this viewer is blocked". A member
		// who has already passed the questionnaire comes back allowed, and hiding
		// the plan from them would be a worse bug than the one being fixed.
		it('offers Subscribe untouched once the gates are satisfied', async () => {
			const user = userEvent.setup();
			const { onSubscribe } = renderCard({ gateAction: null });

			await user.click(screen.getByRole('button', { name: /subscribe/i }));
			expect(onSubscribe).toHaveBeenCalledTimes(1);
			expect(screen.queryByRole('note')).toBeNull();
		});

		// Until the verdict lands we do not know which of the two it is, so the
		// button keeps its label and its box but cannot be pressed — the same
		// treatment the membership lookup already gets.
		it('holds the Subscribe button while the verdict is in flight', () => {
			renderCard({ gatePending: true });

			expect(screen.getByRole('button', { name: /subscribe/i })).toBeDisabled();
		});

		// Nobody asked the backend about a guest, and "Log in to subscribe" is true
		// whatever their eligibility turns out to be.
		it('leaves a guest with the login CTA', () => {
			renderCard({ isAuthenticated: false, gateAction: 'blocked' });

			expect(screen.getByRole('link', { name: /log in to subscribe/i })).toBeInTheDocument();
			expect(screen.queryByRole('note')).toBeNull();
		});

		// Plan-level stops still outrank the gate: a sold-out plan says so, rather
		// than blaming the questionnaire for a card nobody could take anyway.
		it('keeps plan-level stops ahead of the gate', () => {
			renderCard({ plan: makePlan({ sold_out: true }), gateAction: 'blocked' });

			expect(screen.getByText('Sold out')).toBeInTheDocument();
			expect(screen.queryByRole('note')).toBeNull();
		});
	});

	// #735, the other half of #733. A blocked gate is not always somebody else's
	// move: `submit_application` means the backend is waiting for an application
	// that does not exist yet, and on a monetized tier only this card can create
	// one — the application has to name a plan or gate #6 refuses it. Withdrawing
	// the CTA and stopping there made manual-approval gating unreachable.
	describe('when the gate is waiting on an application', () => {
		it('offers an apply CTA in place of Subscribe, named for the plan', async () => {
			const user = userEvent.setup();
			const { onApply, onSubscribe } = renderCard({
				gateAction: 'apply'
			});

			// The accessible name carries the plan: several of these sit on one tier
			// and a screen-reader user hears them out of context.
			const cta = screen.getByRole('button', {
				name: m['membershipPlans.applyCtaAria']({ plan: 'Monthly' })
			});
			expect(cta).toHaveTextContent(m['membershipPlans.applyCta']());
			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			// Approval comes BEFORE the charge; the helper says so rather than
			// letting the member expect a checkout.
			expect(screen.getByText(m['membershipPlans.applySubscribeHelper']())).toBeInTheDocument();

			await user.click(cta);
			expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }), 'join');
			expect(onSubscribe).not.toHaveBeenCalled();
		});

		it('says the free plan will be joined, not paid for, once approved', () => {
			renderCard({
				plan: makePlan({ payment_method: 'free', price: '0.00', period_unit: 'lifetime' }),
				gateAction: 'apply'
			});

			expect(screen.getByText(m['membershipPlans.applyJoinHelper']())).toBeInTheDocument();
			expect(screen.queryByText(m['membershipPlans.applySubscribeHelper']())).toBeNull();
		});

		// One step later in the same story: the previous application was rejected
		// and the backend says a fresh one supersedes it.
		it('offers an apply-again CTA in re-apply mode', async () => {
			const user = userEvent.setup();
			const { onApply } = renderCard({ gateAction: 'reapply' });

			const cta = screen.getByRole('button', {
				name: m['membershipPlans.reapplyCtaAria']({ plan: 'Monthly' })
			});
			expect(cta).toHaveTextContent(m['membershipPlans.reapplyCta']());

			await user.click(cta);
			expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }), 'reapply');
		});

		// The waiting half of the same gate: an application IS on file, staff are
		// deciding, and there is nothing for the member to press. It must not
		// collapse into the apply branch and invite a duplicate row.
		it('keeps a wait state as a note, with no control to press', () => {
			renderCard({
				gateAction: 'blocked'
			});

			expect(screen.getByRole('note')).toHaveTextContent(
				m['membershipPlans.gatedSubscribeHelper']()
			);
			expect(screen.queryByRole('button')).toBeNull();
		});

		// Plan-level stops still outrank the gate, apply branch included: an apply
		// button on a sold-out plan would be an application for a plan nobody can
		// take.
		it('does not offer to apply for a sold-out plan', () => {
			const { onApply } = renderCard({ plan: makePlan({ sold_out: true }), gateAction: 'apply' });

			expect(screen.getByText('Sold out')).toBeInTheDocument();
			expect(screen.queryByRole('button')).toBeNull();
			expect(onApply).not.toHaveBeenCalled();
		});

		// Same reason the Subscribe button is held: until both lookups answer we do
		// not know which branch this is.
		it('holds the apply CTA while the verdict is still settling', () => {
			renderCard({ gateAction: 'apply', subscriptionLoading: true });

			expect(
				screen.getByRole('button', { name: m['membershipPlans.applyCtaAria']({ plan: 'Monthly' }) })
			).toBeDisabled();
		});
	});

	// A FREE plan is un-billed like an OFFLINE one but, unlike it, members take it
	// themselves: `POST …/subscribe` accepts it and activates on the spot. Routing
	// it into the "managed by the organization" dead end would hide a plan the
	// backend is willing to grant.
	describe('a free plan', () => {
		const freePlan = () =>
			makePlan({
				name: 'Supporter',
				payment_method: 'free',
				price: '0.00',
				period_unit: 'lifetime'
			});

		it('states the price as Free and says the membership never expires', () => {
			renderCard({ plan: freePlan() });

			expect(screen.getByText('Free')).toBeInTheDocument();
			expect(screen.getByText('Never expires')).toBeInTheDocument();
			expect(screen.queryByText(/€0\.00/)).toBeNull();
			expect(screen.queryByText('Managed manually by the organization.')).toBeNull();
		});

		it('offers a join CTA that hands the plan to the caller', async () => {
			const user = userEvent.setup();
			const { onSubscribe } = renderCard({ plan: freePlan() });

			await user.click(screen.getByRole('button', { name: /join for free/i }));

			expect(onSubscribe).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }));
		});

		it('sends a guest to log in with join wording, not subscribe wording', () => {
			renderCard({ plan: freePlan(), isAuthenticated: false });

			const link = screen.getByRole('link', { name: /log in to join/i });
			expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme%2Fmembership');
		});

		// Plan-level stops still apply: a capped free plan can fill up.
		it('still withdraws the CTA when it is sold out', () => {
			renderCard({ plan: makePlan({ payment_method: 'free', price: '0.00', sold_out: true }) });

			expect(screen.getByText('Sold out')).toBeInTheDocument();
			expect(screen.queryByRole('button')).toBeNull();
		});
	});

	// An OFFLINE plan may also be lifetime — it just has a real price to state.
	it('quotes a paid lifetime plan as a one-time amount', () => {
		renderCard({
			plan: makePlan({ payment_method: 'offline', price: '50.00', period_unit: 'lifetime' })
		});

		expect(screen.getByText('€50.00 · one-time')).toBeInTheDocument();
		expect(screen.getByText('Never expires')).toBeInTheDocument();
	});
});

describe('PlanCard calendar quote', () => {
	const base = {
		period_alignment: 'calendar',
		period_unit: 'year',
		period_count: 1,
		calendar_start_month: 1,
		price: '40.00',
		first_period_end: '2027-01-01T00:00:00Z'
	} as Partial<PublicPlanSchema>;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	it('says the first charge is partial and the full price follows', () => {
		renderCard({
			plan: makePlan({ ...base, first_period_price: '12.50', first_period_pricing: 'prorated' })
		});
		expect(screen.getByText('Calendar year from January')).toBeInTheDocument();
		expect(screen.getByTestId('plan-first-period-quote')).toHaveTextContent(
			/First period until December 31, 2026: €12\.50 \(partial\)\. Then €40\.00 \/ year\./
		);
	});

	it('says a free first period is free until the boundary', () => {
		renderCard({
			plan: makePlan({ ...base, first_period_price: '0.00', first_period_pricing: 'prorated' })
		});
		expect(screen.getByTestId('plan-first-period-quote')).toHaveTextContent(
			'Free until December 31, 2026, then €40.00 / year.'
		);
	});

	it('says late joiners still pay the full price for a full-pricing plan', () => {
		renderCard({
			plan: makePlan({
				...base,
				payment_method: 'offline',
				first_period_price: '40.00',
				first_period_pricing: 'full'
			})
		});
		expect(screen.getByTestId('plan-first-period-quote')).toHaveTextContent(
			/This period ends on December 31, 2026\. Joining now costs the full €40\.00, however little of the period is left\./
		);
	});

	it('shows nothing extra for a rolling plan', () => {
		renderCard();
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});

	const quoted = { ...base, first_period_price: '12.50', first_period_pricing: 'prorated' };

	it("hides the quote on the viewer's own plan", () => {
		renderCard({ plan: makePlan(quoted), subscription: makeSub() });
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});

	it('hides the quote when switching from another plan (anchor is kept)', () => {
		renderCard({ plan: makePlan({ ...quoted, id: 'plan-2' }), subscription: makeSub() });
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});

	it('hides the quote on a sold-out plan', () => {
		renderCard({ plan: makePlan({ ...quoted, sold_out: true }) });
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});

	it('hides the quote when a gate blocks the viewer', () => {
		renderCard({ plan: makePlan(quoted), gateAction: 'blocked' });
		expect(
			screen.getByText(m['membershipPlans.gatedSubscribeHelper'](), { exact: false })
		).toBeInTheDocument();
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});

	it('hides the quote when sales are paused', () => {
		renderCard({ plan: makePlan({ ...quoted, sales_status: 'paused' }) });
		expect(screen.queryByTestId('plan-first-period-quote')).not.toBeInTheDocument();
	});
});
