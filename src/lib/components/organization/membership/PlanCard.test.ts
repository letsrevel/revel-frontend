import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import PlanCard from './PlanCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

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
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
	});

	it('shows the plan name, price and description', () => {
		renderCard({ plan: makePlan({ description: 'Two lines\nof perks' }) });

		expect(screen.getByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
		expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
		expect(screen.getByText(/two lines/i)).toBeInTheDocument();
	});

	// Offline plans are settled with the organizers directly — there is no
	// checkout to send the member to, so the card states the constraint and, when
	// the org has somewhere to be reached, offers a way to reach them.
	describe('an offline plan', () => {
		const offlinePlan = () => makePlan({ payment_method: 'offline' });

		it('offers the contact form when the org takes messages that way', () => {
			const { onSubscribe } = renderCard({
				plan: offlinePlan(),
				contactMethod: 'form'
			});

			expect(screen.getByText(m['membershipPlans.offlineManaged']())).toBeInTheDocument();
			// Named for the org: "Contact organizer" alone does not say who, and
			// these repeat down a page of plans.
			expect(
				screen.getByRole('button', {
					name: m['orgContactButton.contactAriaLabel']({ organizationName: 'Acme' })
				})
			).toBeInTheDocument();
			// Still no checkout — the CTA contacts, it does not subscribe.
			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			expect(onSubscribe).not.toHaveBeenCalled();
		});

		it('offers a mailto link when the org publishes an address', () => {
			renderCard({
				plan: offlinePlan(),
				contactMethod: 'email',
				contactEmail: 'hello@acme.test'
			});

			expect(screen.getByText(m['membershipPlans.offlineManaged']())).toBeInTheDocument();
			const link = screen.getByRole('link', {
				name: m['orgContactButton.contactAriaLabel']({ organizationName: 'Acme' })
			});
			expect(link).toHaveAttribute('href', 'mailto:hello@acme.test');
		});

		// The trap this guards: `contact_method === 'email'` with no address on
		// file renders nothing at all, so gating the copy on the method alone
		// would promise a button that never arrives.
		it('says only what is true when the email method has no address on file', () => {
			renderCard({
				plan: offlinePlan(),
				contactMethod: 'email',
				contactEmail: null
			});

			expect(screen.getByText(m['membershipPlans.offlineManaged']())).toBeInTheDocument();
			expect(screen.queryByRole('button')).toBeNull();
			expect(screen.queryByRole('link')).toBeNull();
		});

		it('states the constraint alone when the org accepts no contact', () => {
			const { onSubscribe } = renderCard({ plan: offlinePlan(), contactMethod: 'none' });

			expect(screen.getByText(m['membershipPlans.offlineManaged']())).toBeInTheDocument();
			expect(screen.queryByRole('button')).toBeNull();
			expect(screen.queryByRole('link')).toBeNull();
			expect(onSubscribe).not.toHaveBeenCalled();
		});

		// The copy must not tell anybody to make contact it cannot offer — the
		// dead end the CTA replaced.
		it('never instructs the viewer to make contact in the sentence itself', () => {
			renderCard({ plan: offlinePlan(), contactMethod: 'none' });

			expect(screen.queryByText(/contact them/i)).toBeNull();
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
				gateAction: 'blocked',
				gateReason: 'This organization asks new members to fill in a questionnaire first.'
			});

			expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
			expect(
				screen.getByText(m['membershipPlans.gatedSubscribeHelper'](), { exact: false })
			).toBeInTheDocument();
			expect(
				screen.getByText('This organization asks new members to fill in a questionnaire first.')
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
				gateReason: 'Membership requests are approved by the organization.',
				gateRequirementsId: 'tier-1-requirements'
			});

			const note = screen.getByRole('note');
			expect(note).toHaveAttribute('aria-describedby', 'tier-1-requirements');
			expect(note).toHaveTextContent('Membership requests are approved by the organization.');
		});

		// Manual approval has the same shape as the questionnaire: apply, be
		// approved, then pay. Nothing to press until the first two happen.
		it('withdraws the free-join CTA too, in join wording', () => {
			renderCard({
				plan: makePlan({ payment_method: 'free', price: '0.00', period_unit: 'lifetime' }),
				gateAction: 'blocked',
				gateReason: 'Membership requests are approved by the organization.'
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
				gateAction: 'apply',
				gateReason: m['membershipEligibility.reason.requires_approval']()
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
				gateAction: 'blocked',
				gateReason: m['membershipEligibility.wait.approval']()
			});

			expect(screen.getByRole('note')).toHaveTextContent(
				m['membershipEligibility.wait.approval']()
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
			expect(screen.queryByText(m['membershipPlans.offlineManaged']())).toBeNull();
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
