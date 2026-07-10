import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createTicketTier, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J6.3 (USER_JOURNEYS.md) — online fixed-price ticket via Stripe HOSTED
// checkout: purchase → redirect to checkout.stripe.com → the reserved ticket
// is PENDING pre-payment → pay with the test card → the `stripe listen`
// webhook flips it ACTIVE.
//
// Requires the full Stripe test-mode setup from tests/e2e/README.md (backend
// bootstrapped with CONNECTED_TEST_STRIPE_ID + `stripe listen` forwarder).
//
// Isolation: API-arranged event on the Stripe-connected Org Alpha with an
// online tier, and a throwaway buyer (per-user ticket limits).

test.describe('J6 Stripe online checkout @p1', () => {
	test('purchase → PENDING pre-payment → pay on Stripe → webhook → ACTIVE', async ({ browser }) => {
		// Stripe's hosted page + webhook round-trip don't fit the default budget.
		test.setTimeout(240_000);

		const [event, user] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('StripeBuyer')
		]);
		await createTicketTier(event.id, { name: 'Online Entry' });

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await expect(page.getByRole('heading', { name: 'Online Entry' }).first()).toBeVisible();

		// CTA → tier dialog → confirm-purchase dialog → redirect to Stripe.
		// Same idempotent-loop shape as free-tier.spec.ts: clicks during dialog
		// re-renders are occasionally dropped, so retry from whatever state the
		// UI is in until the Stripe URL is reached.
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const proceed = page.getByRole('button', { name: 'Proceed to Payment' });
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (await proceed.isVisible()) {
				await proceed.click();
			} else if (await tierDialog.isVisible()) {
				await tierDialog.getByRole('button', { name: 'Buy Ticket' }).click();
				await proceed.click();
			} else {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				await tierDialog.getByRole('button', { name: 'Buy Ticket' }).click();
				await proceed.click();
			}
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });

		// The checkout session stays open — remember it, then verify the
		// reserved ticket is visibly PENDING before any payment happened.
		const stripeUrl = page.url();

		const pendingCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Pending/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(pendingCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		// Resume the same session and pay with the Stripe test card.
		await page.goto(stripeUrl);
		await completeStripeCheckout(page);

		// Activation arrives via the webhook, not the redirect — poll the
		// dashboard until the ticket flips ACTIVE.
		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(activeCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		await context.close();
	});
});
