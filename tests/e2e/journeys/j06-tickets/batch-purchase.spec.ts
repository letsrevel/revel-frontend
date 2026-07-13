import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 (USER_JOURNEYS.md) — batch purchase: the checkout dialog's quantity
// stepper (rendered only while more than one ticket is allowed) claims
// several tickets in one go with a guest-name input per extra ticket, and the
// per-user tier limit shrinks the allowance until the buy affordance
// disappears entirely. Checkout is array-based server-side — one payload item
// per ticket — and a free tier keeps Stripe out of the journey.
//
// Isolation: arranged event + throwaway buyer (the limit is per-user state);
// the auto "General Admission" tier is dropped so the arranged tier is the
// only claimable one.

test.describe('J6 batch purchase @p3', () => {
	test('stepper claims 2 of 3, remaining allowance is 1, then the limit locks', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Batch')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Group Entry',
			payment_method: 'free',
			price: '0.00',
			max_tickets_per_user: 3
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// Tier dialog → confirmation dialog with the quantity stepper capped at
		// the per-user limit. The whole sequence runs as an idempotent loop
		// (clicks during dialog re-renders are occasionally dropped).
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const quantityLabel = page.getByText('Number of Tickets');
		await expect(async () => {
			if (await quantityLabel.isVisible()) return;
			if (await tierDialog.isVisible()) {
				await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
			} else {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
			}
			await expect(quantityLabel).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });
		await expect(page.getByText('(max 3)')).toBeVisible();

		// Take 2 of the 3 allowed — a second guest-name input appears.
		await page.getByRole('button', { name: 'Increase quantity' }).click();
		await expect(page.getByText('Ticket Holders', { exact: true })).toBeVisible();
		await page.getByPlaceholder('Guest 2 name').fill('E2E Guest Two');

		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		const claim = page.getByRole('button', { name: 'Claim Ticket', exact: true });
		await expect(async () => {
			if (await success.isVisible()) return;
			await claim.click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 40_000 });
		await page.keyboard.press('Escape');

		// Both tickets land as individual Active cards in the dashboard.
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(page.getByText('Showing 2 of 2')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });
		await expect(
			page
				.locator('article, li, div')
				.filter({ hasText: event.name })
				.filter({ hasText: /Active/i })
				.first()
		).toBeVisible();

		// Back on the event, the sidebar offers "Buy More Tickets" — but the
		// remaining allowance is 1, so the confirmation dialog renders WITHOUT
		// the quantity stepper this time.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		const claimAgain = page.getByRole('button', { name: 'Claim Ticket', exact: true });
		await expect(async () => {
			if (await claimAgain.isVisible()) return;
			await page
				.getByRole('button', { name: 'Buy More Tickets' })
				.filter({ visible: true })
				.first()
				.click();
			await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
			await expect(claimAgain).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });
		await expect(page.getByText('Number of Tickets')).toBeHidden();
		await expect(async () => {
			if (await success.isVisible()) return;
			await claimAgain.click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 40_000 });
		await page.keyboard.press('Escape');

		// Limit exhausted (3/3): the buy affordance is gone for good.
		await expect(async () => {
			await gotoHydrated(page, event.path);
			await expect(
				page.getByRole('button', { name: 'Show Tickets (3)' }).filter({ visible: true }).first()
			).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Buy More Tickets' })).toBeHidden();

		await context.close();
	});
});
