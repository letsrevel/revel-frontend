import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';

// J6.2 (USER_JOURNEYS.md) — free-tier ticket: claim → ACTIVE immediately →
// visible in /dashboard/tickets → transactional confirmation email.
//
// #853 rewrite (wave 2, task 11 blast-radius fix): the legacy `TicketTierModal`
// ("Select Your Ticket") + `TicketConfirmationDialog` ("Your Ticket" claim
// button) this test drove are both deleted — this spec was outside every
// prior wave's assigned file list and was left structurally broken (it never
// reached the success modal at all) until the full `j06+j07+j08` matrix gate
// caught it here. The default "Free Entry" tier is `quickBuyEligible` (GA,
// 'none' seat_assignment_mode) — its inline stepper + the sticky
// `CartSummaryBar` replace the dialog cluster. `require_ticket_names`
// defaults true on `createTicketedEvent`'s arranged event, so Buy opens the
// checkout sheet even at quantity 1 (`EventCart.needsSheet`) — unlike the old
// dialog, the sheet never prefills ticket 1's name with the buyer's own
// profile (wave-1 convention, see best-available.spec.ts).
//
// Isolation: an API-arranged event (the seeded events' free tiers only go on
// sale 30 days before start, so they drift in and out of purchasability) and
// a THROWAWAY registered+verified user (tickets consume per-user quotas, so a
// persona would make the spec single-shot).

test.describe('J6 free-tier ticket @p0', () => {
	test('claim free ticket → active in dashboard → confirmation email', async ({ browser }) => {
		const [event, user] = await Promise.all([
			createTicketedEvent(),
			createVerifiedUser('FreeTier')
		]);
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await expect(page.getByRole('heading', { name: 'Free Entry' }).first()).toBeVisible();

		// Stepper → Buy → sheet (names required) → Claim. Idempotent loop:
		// clicks during rerenders are occasionally dropped.
		const stepper = page.getByRole('group', { name: 'Quantity for Free Entry' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		await stepper.getByRole('button', { name: 'Add one Free Entry' }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(async () => {
			if (await sheet.isVisible()) return;
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 30_000 });
		await sheet.getByLabel('Name for ticket 1').fill('E2E Free Buyer');

		const success = page.getByRole('dialog', { name: 'Your Ticket' });
		await expect(async () => {
			if (await success.isVisible()) return;
			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Dashboard shows the ticket as Active. Reload-retry: a silently
		// unauthorized my-tickets query renders the empty state instead of an
		// error (issue #596 item 1) and heals on a fresh load.
		const ticketCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(ticketCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		// Transactional confirmation email is delivered immediately (inline Celery).
		const email = await waitForEmail({ to: user.email, subject: 'icket' });
		expect(email.Subject).toMatch(/ticket/i);

		await context.close();
	});
});
