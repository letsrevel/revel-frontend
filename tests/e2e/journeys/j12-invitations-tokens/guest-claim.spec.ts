import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import {
	createEventToken,
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	uniqueEmail
} from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';

// Backend #923 — guests can act on invitation links without an account. The
// whole journey runs logged out: the join page offers "Continue as guest" on
// a can_attend_without_login event and lands on the event page with ?et=; the
// tier listing honours the granting link (X-Event-Token on the SSR fetch) and
// reports the invited-only tier purchasable; guest checkout claims the link
// server-side before tier-access checks; the emailed confirmation mints the
// ticket. Every step exists only because of #923 — without the claim the
// checkout would 403 "You are not allowed to purchase from this tier."

test.describe('J12 guest invitation-link claim @p1', () => {
	test('join page → continue as guest → invited tier unlocked → checkout → email confirm', async ({
		page
	}) => {
		// Email round-trip + checkout don't fit the default budget.
		test.setTimeout(180_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true, require_ticket_names: false }
		});
		await deleteDefaultTier(event.id); // its public stepper would blur the assertion
		const tier = await createTicketTier(event.id, {
			name: 'Invited Entry',
			purchasable_by: 'invited',
			payment_method: 'free',
			price: '0.00'
		});
		const token = await createEventToken(event.id);
		const email = uniqueEmail('GuestClaim');

		// Join page, logged out: sign-in stays primary, guest is the alternative.
		await gotoHydrated(page, `/join/event/${token.id}`);
		await expect(page.getByText("You've been invited!")).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toBeVisible();
		const guestLink = page.getByRole('link', { name: 'Continue as guest' });
		await expect(guestLink).toBeVisible();
		await guestLink.click();

		// Lands on the event page carrying the token.
		await page.waitForURL((url) => url.searchParams.get('et') === token.id, { timeout: 15_000 });

		// The granting link flips the invited-only tier purchasable: the
		// quick-buy stepper renders where an anonymous visitor without a token
		// gets a disabled "Not Eligible" (see j07 invited-tier-gating.spec.ts).
		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Not Eligible' })).toHaveCount(0);
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		// Guest checkout sheet: email only (require_ticket_names off), Claim
		// hands off to the emailed confirmation. Idempotent loop, same shape as
		// guest-email-only-checkout.spec.ts — clicks during hydration/dialog
		// re-renders are occasionally dropped.
		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const emailSent = page.getByText('Check your email!');
		await expect(async () => {
			if (await emailSent.isVisible()) return;
			if (!(await sheet.isVisible())) {
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			await sheet.getByLabel('Email address').fill(email);
			await expect(sheet.getByLabel('Email address')).toHaveValue(email, { timeout: 2_000 });
			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(emailSent).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 90_000 });

		// The emailed link mints the ticket — the checkout's claim already
		// passed tier access, and the confirm re-claim is idempotent.
		const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
		expect(message.Subject).toContain(event.name);
		const link = extractLink(message, /confirm-action\?token=/);
		await page.goto(link);
		await expect(async () => {
			const retry = page.getByRole('button', { name: 'Try Again' });
			if (await retry.isVisible()) await retry.click();
			await expect(page.getByRole('heading', { name: 'Ticket Confirmed!' })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });
	});
});
