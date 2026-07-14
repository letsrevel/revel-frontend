import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import {
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	uniqueEmail,
	type CreatedEvent
} from '../../support/factories';
import { completeStripeCheckout } from '../../support/stripe';

// J7 (USER_JOURNEYS.md) — guest ONLINE (Stripe) checkout on a
// `can_attend_without_login` event, the guest half of the two-step
// reserve → checkout-session contract (#464 / backend #632): the guest
// dialog's submit reserves capacity, then chains the public
// `/reservations/{id}/checkout-session/public` call and redirects to the
// hosted Stripe page. Unlike free/offline guest tiers there is NO email
// confirmation step — the reservation is immediate.
//
// Tiers are capped at max_tickets_per_user=1 so the dialog stays in its
// single-ticket shape (no quantity stepper / per-ticket name inputs), and the
// auto-created "General Admission" tier is dropped because every tier card
// shows the same "Get Ticket" CTA to a logged-out guest (strict mode).

/** Fill the guest dialog and submit until the Stripe redirect lands. */
async function buyAsGuest(page: Page, event: CreatedEvent, email: string): Promise<void> {
	await gotoHydrated(page, event.path);

	const guestDialog = page.getByRole('dialog', { name: 'Get tickets without an account' });
	const tierCta = page.getByRole('button', { name: 'Get Ticket', exact: true }).first();

	// Same idempotent-loop shape as stripe-online.spec.ts: clicks during
	// hydration/dialog re-renders are occasionally dropped, so retry from
	// whatever state the UI is in until the Stripe URL is reached.
	await expect(async () => {
		if (page.url().includes('checkout.stripe.com')) return;
		if (!(await guestDialog.isVisible())) {
			await tierCta.click();
			await expect(guestDialog).toBeVisible({ timeout: 5_000 });
		}
		await guestDialog.getByLabel('Email address').fill(email);
		await guestDialog.getByLabel('First name').fill('E2E');
		await guestDialog.getByLabel('Last name').fill('GuestBuyer');
		await expect(guestDialog.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
		await guestDialog.getByRole('button', { name: 'Get Ticket', exact: true }).click();
		await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
	}).toPass({ timeout: 90_000 });
}

test.describe('J7 guest online checkout @p2', () => {
	test('fixed-price: guest dialog → reserve → Stripe session → pay → back on the app', async ({
		page
	}) => {
		// Stripe's hosted page round-trip doesn't fit the default budget.
		test.setTimeout(240_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true }
		});
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, { name: 'Guest Online Entry', max_tickets_per_user: 1 });

		await buyAsGuest(page, event, uniqueEmail('GuestStripe'));

		// Paying proves the reservation carried real Payment rows: Stripe only
		// redirects back after a session the webhook can reconcile.
		await completeStripeCheckout(page);
		await expect(page).toHaveURL(/localhost:5173/, { timeout: 20_000 });
	});

	test('PWYC: guest dialog with amount → reserve → Stripe session reached', async ({ page }) => {
		test.setTimeout(180_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true }
		});
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Guest PWYC Online',
			price_type: 'pwyc',
			pwyc_min: '5.00',
			pwyc_max: '50.00',
			max_tickets_per_user: 1
		});

		// The dialog pre-fills the PWYC amount with the tier minimum; reaching
		// the hosted Stripe page proves the PWYC reserve → session chain.
		await buyAsGuest(page, event, uniqueEmail('GuestPwyc'));
	});
});
