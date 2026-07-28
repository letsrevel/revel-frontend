import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PlanCard from './PlanCard.svelte';
import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';

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

function renderCard(props: Record<string, unknown> = {}) {
	const onSubscribe = vi.fn();
	const result = render(PlanCard, {
		props: {
			plan: makePlan(),
			isAuthenticated: true,
			onSubscribe,
			organizationSlug: 'acme',
			...props
		}
	});
	return { ...result, onSubscribe };
}

describe('PlanCard', () => {
	it('shows the plan name, price and description', () => {
		renderCard({ plan: makePlan({ description: 'Two lines\nof perks' }) });

		expect(screen.getByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
		expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
		expect(screen.getByText(/two lines/i)).toBeInTheDocument();
	});

	// Offline plans are settled with the organizers directly — there is no
	// checkout to send the member to.
	it('explains an offline plan instead of offering a CTA', () => {
		const { onSubscribe } = renderCard({ plan: makePlan({ payment_method: 'offline' }) });

		expect(screen.getByText(/managed by the organization/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
		expect(onSubscribe).not.toHaveBeenCalled();
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
	it('sends a guest to the login page with a return URL back to the org', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: /log in to subscribe/i });
		expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme');
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
});
