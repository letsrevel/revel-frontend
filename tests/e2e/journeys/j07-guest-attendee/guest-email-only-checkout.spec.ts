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
// whose `require_ticket_names` is OFF: the guest dialog collects ONLY an
// email (the first/last-name fields guest-online-checkout.spec.ts fills are
// not rendered at all), and the reserve → checkout-session chain still reaches
// the hosted Stripe page and pays.
//
// Isolation: an own event — the flag changes the guest dialog's shape. The
// tier is capped at max_tickets_per_user=1 so the dialog stays in its
// single-ticket shape, and the auto "General Admission" tier is dropped
// because every tier card shows the same "Get Ticket" CTA to a logged-out
// guest (strict mode).

test.describe('J7 guest email-only checkout @p2', () => {
	test('guest dialog shows no name fields and reaches Stripe with email only', async ({ page }) => {
		// Stripe's hosted page round-trip doesn't fit the default budget.
		test.setTimeout(240_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true, require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, { name: 'Email Only Entry', max_tickets_per_user: 1 });

		const email = uniqueEmail('EmailOnly');
		await gotoHydrated(page, event.path);

		const guestDialog = page.getByRole('dialog', { name: 'Get tickets without an account' });
		const tierCta = page.getByRole('button', { name: 'Get Ticket', exact: true }).first();

		// Same idempotent-loop shape as guest-online-checkout.spec.ts: clicks
		// during hydration/dialog re-renders are occasionally dropped, so retry
		// from whatever state the UI is in until the Stripe URL is reached.
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await guestDialog.isVisible())) {
				await tierCta.click();
				await expect(guestDialog).toBeVisible({ timeout: 5_000 });
			}
			await expect(guestDialog.getByLabel('First name')).toBeHidden();
			await expect(guestDialog.getByLabel('Last name')).toBeHidden();
			await guestDialog.getByLabel('Email address').fill(email);
			await expect(guestDialog.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await guestDialog.getByRole('button', { name: 'Get Ticket', exact: true }).click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });

		// Paying proves the email-only reservation carried real Payment rows:
		// Stripe only redirects back after a session the webhook can reconcile.
		await completeStripeCheckout(page);
		await expect(page).toHaveURL(/localhost:5173/, { timeout: 20_000 });
	});
});
