import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	uniqueEmail
} from '../../support/factories';
import { gotoHydrated } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J7 (#753) — email-only guest checkout on a `can_attend_without_login` event
// whose `require_ticket_names` is OFF: the checkout sheet's guest identity
// block (`GuestIdentityFields`) collects ONLY an email — no first/last name —
// and per-ticket holder-name inputs are skipped too (`CheckoutSheetGroup`
// gates `GuestNameInputs` on the same flag). The reserve → checkout-session
// chain still reaches the hosted Stripe page and pays.
//
// #853 rewrite (task 9): the legacy `GuestTicketDialog` this exercised is
// deleted; the guest now gets the same inline stepper + `CartSummaryBar` +
// checkout sheet an authenticated buyer sees (Buy always opens the sheet for
// a guest — `EventCart.needsSheet`).
//
// Isolation: an own event — the flag changes the sheet's identity/name
// fields. The auto "Free Entry" tier is dropped so only the target tier's
// stepper renders.

test.describe('J7 guest email-only checkout @p2', () => {
	test('sheet identity block shows only email and reaches Stripe with email only', async ({
		page
	}) => {
		// Stripe's hosted page round-trip doesn't fit the default budget.
		test.setTimeout(240_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true, require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, { name: 'Email Only Entry' });

		const email = uniqueEmail('EmailOnly');
		await gotoHydrated(page, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const payNow = sheet.getByRole('button', { name: 'Pay Now', exact: true });

		// Idempotent loop (same shape as guest-online-checkout.spec.ts): clicks
		// during hydration/dialog re-renders are occasionally dropped, so retry
		// from whatever state the UI is in until the Stripe URL is reached.
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await sheet.isVisible())) {
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			await expect(sheet.getByLabel('First name')).toBeHidden();
			await expect(sheet.getByLabel('Last name')).toBeHidden();
			await expect(sheet.getByLabel('Name for ticket 1')).toBeHidden();
			await sheet.getByLabel('Email address').fill(email);
			await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await payNow.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });

		// Paying proves the email-only reservation carried real Payment rows:
		// Stripe only redirects back after a session the webhook can reconcile.
		await completeStripeCheckout(page);
		await expect(page).toHaveURL(/localhost:5173/, { timeout: 20_000 });
	});
});
