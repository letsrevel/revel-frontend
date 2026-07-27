import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createMembershipTier,
	createSubscriptionPlan,
	createVerifiedUser,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { planCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J23.3 / J23.4 (USER_JOURNEYS.md) — the member-initiated hosted-checkout
// journey: Subscribe → SubscribeDialog → checkout.stripe.com → pay → back on
// the org page, where CheckoutReturnCard polls until the `stripe listen`
// webhook flips the subscription ACTIVE.
//
// MUST-COVER here and nowhere else: the `?membership_success=true` flag is
// consumed in onMount with the RAW history API (see MembershipSection —
// $app/navigation's replaceState throws during hydration). jsdom cannot
// exercise that, so this spec is the only proof it happens.
//
// Requires the full Stripe test-mode setup from tests/e2e/README.md (backend
// bootstrapped with CONNECTED_TEST_STRIPE_ID + the `stripe listen` forwarder).
//
// Isolation / retry-safety: Org Alpha is the only Stripe-connected org, so the
// plans live there — but every test arranges its OWN uniqueName()-d tier + plan
// and its OWN throwaway subscriber inside the test body. A retry therefore
// never inherits the half-paid subscription of the attempt before it (the
// backend refuses a second non-terminal subscription per user per org).

const ORG_SLUG = 'revel-events-collective';
const ORG_PATH = `/org/${ORG_SLUG}`;

/** An online €15/month plan on a fresh tier of Org Alpha, plus its subscriber. */
async function arrangeOnlinePlan(label: string) {
	const [tier, user] = await Promise.all([
		createMembershipTier('owner', ORG_SLUG, uniqueName(`${label} Tier`)),
		createVerifiedUser(label)
	]);
	const plan = await createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
		name: uniqueName(`${label} Plan`),
		payment_method: 'online',
		price: '15.00',
		currency: 'EUR'
	});
	return { plan, user };
}

/**
 * Open the plan's SubscribeDialog, check its disclaimers, and hand off to
 * Stripe. Idempotent-loop shaped like j06's stripe-online spec: clicks landing
 * during a dialog re-render are occasionally dropped, so retry from whatever
 * state the UI is in until the hosted page is reached. Re-clicking "Continue to
 * payment" is safe — the backend resumes the pending checkout session it
 * already minted instead of creating a second one.
 */
async function subscribeThroughDialog(page: Page, planName: string): Promise<void> {
	const card = planCard(page, planName);
	await card.getByRole('button', { name: 'Subscribe' }).click({ timeout: 15_000 });

	const dialog = page.getByRole('dialog', { name: `Subscribe to ${planName}` });
	await expect(dialog).toBeVisible({ timeout: 15_000 });
	await expect(dialog.getByText('€15.00 / month')).toBeVisible();
	await expect(
		dialog.getByText("You'll be charged €15.00 now, then automatically each renewal.")
	).toBeVisible();
	await expect(dialog.getByText('Payments are processed securely by Stripe.')).toBeVisible();

	await expect(async () => {
		if (page.url().includes('checkout.stripe.com')) return;
		if (await dialog.isVisible()) {
			await dialog.getByRole('button', { name: 'Continue to payment' }).click();
		} else {
			await card.getByRole('button', { name: 'Subscribe' }).click();
		}
		await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });
	}).toPass({ timeout: 90_000 });
}

test.describe('J23 hosted-checkout subscribe @p2', () => {
	test('subscribe → Stripe → webhook → Welcome card, stripped param, member CTA', async ({
		browser
	}) => {
		// Stripe's hosted page + the webhook round trip don't fit the default budget.
		test.setTimeout(240_000);

		const { plan, user } = await arrangeOnlinePlan('SubOnline');

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, ORG_PATH);
		await waitForClientAuth(page);

		await subscribeThroughDialog(page, plan.name);
		await completeStripeCheckout(page);

		// Back on the org page at the backend-built success URL. NOTE: no
		// waitForClientAuth here — its stall fallback reloads, and a reload would
		// drop the (already consumed) flag and unmount the card under us.
		const confirming = page
			.getByRole('status')
			.filter({ hasText: 'Confirming your subscription…' });
		const welcome = page.getByRole('heading', { name: 'Welcome, member!' });
		// Either phase is a pass: locally the "Confirming…" copy is what shows
		// first (probed — the webhook lands a second or two after the redirect),
		// but asserting it alone would be a race against a fast webhook.
		await expect(confirming.or(welcome)).toBeVisible({ timeout: 30_000 });

		// Activation arrives via the webhook, never the redirect — the card polls.
		await expect(welcome).toBeVisible({ timeout: 120_000 });
		await expect(page.getByText('Your subscription is active.')).toBeVisible();

		// MUST-COVER: the flag was consumed in onMount via the raw history API,
		// so a reload or a back-navigation cannot replay the card.
		await expect(page).toHaveURL(new RegExp(`${ORG_PATH}(?:$|[?#])`));
		expect(page.url()).not.toContain('membership_success');

		// The card invalidates the stale verdicts it invalidates precisely so the
		// rest of the page agrees with it — no reload needed.
		const inlineCard = page.locator('.bg-card').filter({ hasText: 'Your membership' });
		await expect(inlineCard.getByText(plan.name)).toBeVisible({ timeout: 30_000 });
		await expect(inlineCard.getByLabel('Active')).toBeVisible();
		// …and the join CTA is replaced by the member status pill (this one rides
		// on invalidateAll() re-running the server load).
		await expect(page.getByLabel('Membership status: Active')).toBeVisible({ timeout: 30_000 });

		// The account hub tells the same story.
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		const membershipCard = page
			.getByRole('region', { name: 'Memberships' })
			.getByRole('article', { name: 'Revel Events Collective' });
		await expect(membershipCard).toBeVisible({ timeout: 20_000 });
		await expect(membershipCard.getByText(plan.name)).toBeVisible();
		await expect(membershipCard.getByLabel('Active')).toBeVisible();

		// BE #774 follow-up, ONLINE side. This is the only place the real Stripe
		// handles exist, so it is the only place that can prove the admin schema's
		// `stripe_dashboard_url` is actually populated (the unit tests can only
		// prove we render one when given it). The refund control must be gone with
		// it: the backend now 400s refunds for ONLINE payments.
		const adminContext = await browser.newContext();
		await authenticateContext(adminContext, 'owner');
		const admin = await adminContext.newPage();
		await gotoHydrated(admin, `/org/${ORG_SLUG}/admin/members`);
		await waitForClientAuth(admin);
		await admin.getByRole('tab', { name: /Subs/ }).click();
		// Search by email: the display name ("E2E SubOnline") repeats across runs.
		await admin.getByPlaceholder('Search by name or email…').fill(user.email);
		// Filter the row by its email TEXT rather than clicking `.first()`: the
		// search is debounced, so an immediate first-row click lands on whatever
		// unfiltered row was already there and opens the wrong drawer. Text-filtering
		// makes Playwright wait for the list to actually converge. Both layouts
		// qualify — the desktop <tr role="button"> and the mobile <button> each
		// render the email — so one locator covers both projects.
		const row = admin.getByRole('button').filter({ hasText: user.email }).filter({ visible: true });
		await expect(row.first()).toBeVisible({ timeout: 20_000 });
		await row.first().click();

		const drawer = admin.getByRole('dialog').filter({ hasText: user.email });
		await expect(drawer).toBeVisible({ timeout: 15_000 });
		const manageLink = drawer.getByRole('link', { name: 'Manage on Stripe' });
		await expect(manageLink).toBeVisible({ timeout: 15_000 });
		await expect(manageLink).toHaveAttribute('href', /dashboard\.stripe\.com\/.*subscriptions\//);
		await expect(manageLink).toHaveAttribute('target', '_blank');
		// The webhook-recorded payment carries its own Stripe link, and no refund.
		await expect(drawer.getByRole('link', { name: 'View on Stripe' }).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(drawer.getByRole('button', { name: 'Refund', exact: true })).toBeHidden();
		await expect(drawer.getByText('Stripe Dashboard')).toBeVisible();

		await adminContext.close();
		await context.close();
	});

	test('abandon checkout → cancelled card → resume payment → active', async ({ browser }) => {
		test.setTimeout(240_000);

		const { plan, user } = await arrangeOnlinePlan('SubAbandon');

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, ORG_PATH);
		await waitForClientAuth(page);

		await subscribeThroughDialog(page, plan.name);

		// Abandon: walk away from the hosted page onto the backend-built cancel
		// URL instead of paying. The PENDING subscription (and its open Checkout
		// session) survives.
		await gotoHydrated(page, `${ORG_PATH}?membership_cancelled=true`);
		await expect(page.getByRole('heading', { name: 'Checkout not completed' })).toBeVisible({
			timeout: 20_000
		});
		await expect(
			page.getByText("Your payment wasn't completed. You can resume it whenever you're ready.")
		).toBeVisible();

		// Pre-payment state elsewhere on the page: the member's own subscription
		// card says the first payment is still outstanding.
		//
		// Deliberately asserted HERE and not on /account/memberships: that page
		// lists OrganizationMember rows, and an ONLINE plan creates none until the
		// first payment lands (subscription_service.create_subscription only
		// syncs the member row for OFFLINE plans). Probed: `/api/me/memberships`
		// answers `count: 0` at this point, while `/api/me/…/subscription` — what
		// this card reads — already returns the PENDING row.
		const inlineCard = page.locator('.bg-card').filter({ hasText: 'Your membership' });
		await expect(inlineCard.getByLabel('Pending')).toBeVisible({ timeout: 20_000 });
		await expect(inlineCard.getByText('Awaiting first payment')).toBeVisible();

		// Resume: the backend hands back a payable session for the same pending
		// subscription, and the browser leaves for Stripe again.
		await page.getByRole('button', { name: 'Resume payment' }).click();
		await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
		await completeStripeCheckout(page);

		await expect(page.getByRole('heading', { name: 'Welcome, member!' })).toBeVisible({
			timeout: 120_000
		});
		expect(page.url()).not.toContain('membership_success');

		await context.close();
	});
});
