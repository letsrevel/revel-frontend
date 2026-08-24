import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import {
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	uniqueEmail
} from '../../support/factories';
import { completeStripeCheckout } from '../../support/stripe';

// J7 (USER_JOURNEYS.md) — guest ONLINE (Stripe) checkout on a
// `can_attend_without_login` ticketed event, the guest half of the cart
// checkout flow (#853 PR 4): an anonymous visitor gets the SAME inline
// stepper + sticky `CartSummaryBar` an authenticated buyer sees (`TierCard`'s
// `canTransact = isAuthenticated || canAttendWithoutLogin`) — there is no
// separate "Get Ticket" CTA or guest dialog anymore. Buy ALWAYS opens the
// checkout sheet for a guest (`EventCart.needsSheet` is unconditionally true
// when `isGuest`), which is where the buyer identity (email always;
// first/last because `require_ticket_names` defaults true on
// `createTicketedEvent`'s arranged event) and the online-payment heads-up
// notice live. Unlike free/offline guest tiers there is NO email confirmation
// step for `online` — the reservation redirects straight to Stripe.
//
// #853 rewrite (task 9): replaces the deleted `GuestTicketDialog` flow. The
// fixed-price scenario also exercises the stepper's quantity (2) — the old
// `max_tickets_per_user: 1` constraint that kept the legacy single-select
// dialog in its single-ticket shape no longer applies; the stepper handles
// quantity directly.
//
// Isolation: own event + tier per test (`can_attend_without_login`); the
// auto-created "Free Entry" tier is dropped so only the online tier's stepper
// renders.

test.describe('J7 guest online checkout @p2', () => {
	test('fixed-price: stepper → sheet → Stripe session → pay → back on the app', async ({
		page
	}) => {
		// Stripe's hosted page round-trip doesn't fit the default budget.
		test.setTimeout(240_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true }
		});
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, { name: 'Guest Online Entry' });

		await gotoHydrated(page, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		const add = stepper.getByRole('button', { name: `Add one ${tier.name}` });
		await add.click();
		await add.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const payNow = sheet.getByRole('button', { name: 'Pay Now', exact: true });
		const email = uniqueEmail('GuestStripe');

		// Idempotent loop (same shape as stripe-online.spec.ts): clicks during
		// hydration/dialog re-renders are occasionally dropped, so retry from
		// whatever state the UI is in until the Stripe URL is reached.
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await sheet.isVisible())) {
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			// Guest-only cart-wide notice: redirected to Stripe for online payment.
			await expect(
				sheet.getByText(
					"You'll be redirected to our secure payment provider to complete your purchase."
				)
			).toBeVisible();
			await sheet.getByLabel('Email address').fill(email);
			await sheet.getByLabel('First name').fill('E2E');
			await sheet.getByLabel('Last name').fill('GuestBuyer');
			await sheet.getByLabel('Name for ticket 1').fill('E2E Guest 1');
			await sheet.getByLabel('Name for ticket 2').fill('E2E Guest 2');
			await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await payNow.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });

		// Paying proves the reservation carried real Payment rows: Stripe only
		// redirects back after a session the webhook can reconcile.
		await completeStripeCheckout(page);
		await expect(page).toHaveURL(/localhost:5173/, { timeout: 20_000 });
	});

	test('PWYC: sheet with amount → Stripe session reached', async ({ page }) => {
		test.setTimeout(180_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true }
		});
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Guest PWYC Online',
			price_type: 'pwyc',
			pwyc_min: '5.00',
			pwyc_max: '50.00'
		});

		await gotoHydrated(page, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const payNow = sheet.getByRole('button', { name: 'Pay Now', exact: true });
		const email = uniqueEmail('GuestPwyc');

		// Reaching the hosted Stripe page proves the guest PWYC reserve →
		// checkout-session chain; no prefill exists (cart-checkout-sheet.spec.ts
		// established the sheet never prefills a PWYC amount), so it's filled
		// explicitly.
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await sheet.isVisible())) {
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			await sheet.getByLabel('Email address').fill(email);
			await sheet.getByLabel('First name').fill('E2E');
			await sheet.getByLabel('Last name').fill('GuestPwyc');
			await sheet.getByLabel('Name for ticket 1').fill('E2E Guest 1');
			await sheet.getByLabel('Payment Amount').fill('10');
			await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await payNow.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });
	});
});
