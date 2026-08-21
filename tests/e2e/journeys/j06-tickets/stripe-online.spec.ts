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
// #853 rewrite (wave 2, task 11 blast-radius fix): outside every prior wave's
// assigned file list, structurally broken by the `TicketTierModal`/
// `TicketConfirmationDialog` deletion until the full matrix gate caught it
// here (see free-tier.spec.ts's header for the shared rationale). The tier is
// `quickBuyEligible` — its inline stepper + the checkout sheet (names
// required by default) replace the dialog cluster; the sheet's online-payment
// button is "Pay Now" (`cartSheet.payNow`), replacing the old dialog's
// "Buy Ticket" → "Proceed to Payment" two-step.
//
// Requires the full Stripe test-mode setup from tests/e2e/README.md (backend
// bootstrapped with CONNECTED_TEST_STRIPE_ID + `stripe listen` forwarder) —
// without a running `stripe listen` forwarder the webhook never arrives and
// the final ACTIVE poll times out; this is a known, environment-dependent
// failure (same category as self-cancel.spec.ts), not a rewrite defect.
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

		// Stepper → Buy → sheet (names required) → Pay Now → redirect to
		// Stripe. Idempotent loop: clicks during rerenders are occasionally
		// dropped, so retry from whatever state the UI is in until the Stripe
		// URL is reached.
		const stepper = page.getByRole('group', { name: 'Quantity for Online Entry' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const payNow = sheet.getByRole('button', { name: 'Pay Now', exact: true });
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await sheet.isVisible())) {
				if ((await stepper.locator('span[aria-live="polite"]').textContent()) === '0') {
					await stepper.getByRole('button', { name: 'Add one Online Entry' }).click();
				}
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			await sheet.getByLabel('Name for ticket 1').fill('E2E Stripe Buyer');
			await payNow.click();
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
