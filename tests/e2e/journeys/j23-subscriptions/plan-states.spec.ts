import { test, expect } from '../../support/fixtures';
import {
	createMembershipTier,
	createSubscriptionPlan,
	createVerifiedUser,
	getOrganizationId,
	subscribeViaApi,
	updateSubscriptionPlan,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { membershipPath, planCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — member-facing plan AVAILABILITY states on the public
// membership page: sold out (cap occupied), sales paused, offline
// (staff-managed) and the guest CTA. No payment happens anywhere in this file.
//
// The plan grid moved off the org landing page onto /org/[slug]/membership
// (#720) — the landing page keeps only a pointer at it — so every navigation
// here goes to `membershipPath()`.
//
// Everything is arranged on Org Alpha (`revel-events-collective`): it is the
// only Stripe-connected seeded org, and ONLINE plans cannot exist anywhere
// else. Isolation comes from uniqueName()-d tiers/plans (never from the org),
// so a re-run — or a retry — never inherits a predecessor's occupancy.

const ORG_SLUG = 'revel-events-collective';

test.describe('J23 plan availability states @p2', () => {
	test('sold out / paused / offline plans state their reason and offer no CTA', async ({
		browser
	}) => {
		const tierName = uniqueName('States Tier');
		const [tier, orgId, occupier, viewer] = await Promise.all([
			createMembershipTier('owner', ORG_SLUG, tierName),
			getOrganizationId(ORG_SLUG),
			createVerifiedUser('CapFiller'),
			createVerifiedUser('PlanViewer')
		]);

		// Four plans in one tier: the three unavailable shapes plus an open
		// one, so an absent CTA is provably about THIS plan's state and not a
		// broken page.
		const [openPlan, soldOutPlan, pausedPlan, offlinePlan] = await Promise.all([
			createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
				name: uniqueName('Open Plan'),
				payment_method: 'online'
			}),
			createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
				name: uniqueName('Capped Plan'),
				payment_method: 'online',
				max_subscriptions: 1
			}),
			createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
				name: uniqueName('Paused Plan'),
				payment_method: 'online'
			}),
			createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
				name: uniqueName('Offline Plan'),
				payment_method: 'offline'
			})
		]);

		// Occupy the single slot. A PENDING subscription (no payment made)
		// counts: the backend's capacity check excludes only TERMINAL
		// statuses, so an abandoned checkout still holds its card stock.
		const { subscriptionId } = await subscribeViaApi(occupier, orgId, soldOutPlan.id);
		expect(subscriptionId).toBeTruthy();

		// Pausing through the PATCH endpoint rather than at creation: this is
		// the transition an organizer actually performs.
		await updateSubscriptionPlan('owner', ORG_SLUG, pausedPlan.id, { sales_status: 'paused' });

		const context = await browser.newContext();
		await authenticateContext(context, viewer);
		const page = await context.newPage();
		await gotoHydrated(page, membershipPath(ORG_SLUG));
		await waitForClientAuth(page);

		// Control: an open ONLINE plan offers the CTA to this very user.
		const open = planCard(page, openPlan.name);
		await expect(open.getByRole('button', { name: 'Subscribe' })).toBeVisible({
			timeout: 15_000
		});

		// Sold out — badge + helper, and no CTA of any kind.
		const soldOut = planCard(page, soldOutPlan.name);
		await expect(soldOut.getByText('Sold out')).toBeVisible();
		await expect(
			soldOut.getByText('All spots are taken — one may free up if a membership ends.')
		).toBeVisible();
		await expect(soldOut.getByRole('button', { name: 'Subscribe' })).toHaveCount(0);
		await expect(soldOut.getByRole('link', { name: 'Log in to subscribe' })).toHaveCount(0);

		// Sales paused — a softer stop, same absence of a CTA.
		const paused = planCard(page, pausedPlan.name);
		await expect(paused.getByText('Sales paused')).toBeVisible();
		await expect(
			paused.getByText('The organization has temporarily closed sign-ups.')
		).toBeVisible();
		await expect(paused.getByRole('button', { name: 'Subscribe' })).toHaveCount(0);

		// OFFLINE — displayed for information; joining is arranged with staff.
		const offline = planCard(page, offlinePlan.name);
		await expect(
			offline.getByText('Managed by the organization — contact them to join this plan.')
		).toBeVisible();
		await expect(offline.getByRole('button', { name: 'Subscribe' })).toHaveCount(0);
		await expect(offline.getByText('Sold out')).toHaveCount(0);

		await context.close();
	});

	test('guest sees a login CTA instead of Subscribe', async ({ browser }) => {
		const tier = await createMembershipTier('owner', ORG_SLUG, uniqueName('Guest Tier'));
		const plan = await createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
			name: uniqueName('Guest Plan'),
			payment_method: 'online'
		});

		// A context of its own: the `page` fixture would still be anonymous, but
		// an explicit unauthenticated context says so.
		const context = await browser.newContext();
		const page = await context.newPage();
		await gotoHydrated(page, membershipPath(ORG_SLUG));

		const card = planCard(page, plan.name);
		// A real link, not a scripted redirect — it carries the return trip.
		const loginCta = card.getByRole('link', { name: 'Log in to subscribe' });
		await expect(loginCta).toBeVisible({ timeout: 15_000 });
		// PlanCard's return trip still points at the org LANDING page, not at the
		// page the button was pressed on — deliberate on its side (`loginHref` in
		// PlanCard.svelte), and asserted here so a change to it is a decision
		// somebody makes rather than a silent drift.
		await expect(loginCta).toHaveAttribute(
			'href',
			`/login?returnUrl=${encodeURIComponent(`/org/${ORG_SLUG}`)}`
		);
		await expect(card.getByRole('button', { name: 'Subscribe' })).toHaveCount(0);

		await context.close();
	});
});
