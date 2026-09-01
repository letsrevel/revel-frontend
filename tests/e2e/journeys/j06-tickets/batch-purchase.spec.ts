import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 (USER_JOURNEYS.md) — batch purchase: a single tier's inline quick-buy
// stepper claims several tickets in one go, the checkout sheet collects a
// guest name per ticket (`require_ticket_names` stays at its backend default,
// TRUE, for this event — unlike the wave-1 seat-selection specs, which
// deliberately turn it off), and the per-user tier limit shrinks the
// allowance across purchases until the buy affordance disappears entirely.
// Checkout is array-based server-side — one payload item per ticket — and a
// free tier keeps Stripe out of the journey.
//
// #853 rewrite (wave 2, task 11): the legacy `TicketConfirmationDialog`
// quantity stepper + inline guest-name inputs are gone. Quantity now lives on
// the tier card itself (`TierQuantityStepper`, `quickBuyEligible` — a 'none'
// seat_assignment_mode tier always qualifies), and because this event
// requires ticket names, the sticky `CartSummaryBar`'s "Buy" opens the
// checkout sheet (`EventCart.needsSheet`) even for a single-tier, quantity-1
// cart — names are collected there (`sheet.getByLabel('Name for ticket N')`,
// wave-1 convention). The per-user cap shrinking mid-session is now provable
// via the stepper's own "(max N)" hint (`TierQuantityStepper`,
// `ticketConfirmationDialog.maxHint`) rather than the old dialog's "Number of
// Tickets" quantity selector — the buy-more re-entry point itself is #853's
// Task 10b fix (`can_purchase_more`-gated `TicketTierList` render), covered
// end to end by `cart-quick-buy.spec.ts`'s dedicated buy-more test; this spec
// stays focused on the multi-ticket-per-purchase + shrinking-limit property.
//
// Isolation: arranged event + throwaway buyer (the limit is per-user state);
// the auto "General Admission" tier is dropped so the arranged tier is the
// only claimable one.

test.describe('J6 batch purchase @p3', () => {
	test('stepper claims 2 of 3, remaining allowance shrinks to 1, then the limit locks', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Batch')
		]);
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Group Entry',
			payment_method: 'free',
			price: '0.00',
			max_tickets_per_user: 3
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const tierHeading = page.getByRole('heading', { name: 'Ticket Options' });
			const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
			const addButton = stepper.getByRole('button', { name: `Add one ${tier.name}` });
			const summaryBar = page.getByTestId('cart-summary-bar');
			const sheet = page.getByRole('dialog', { name: 'Checkout' });
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });

			// Take 2 of the 3 allowed — the max hint confirms the cap is known
			// up front, before any purchase has happened.
			await expect(stepper).toBeVisible({ timeout: 15_000 });
			await addButton.click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');
			await expect(stepper.getByText('(max 3)')).toBeVisible();
			await addButton.click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

			// Buy opens the sheet (names are required on this event) — a second
			// guest-name input renders for the second ticket.
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible();
			await expect(sheet.getByText('Ticket holder names', { exact: true })).toBeVisible();
			await sheet.getByLabel('Name for ticket 1').fill('E2E Guest One');
			await sheet.getByLabel('Name for ticket 2').fill('E2E Guest Two');

			await expect(async () => {
				if (await success.isVisible()) return;
				await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
				await expect(success).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 40_000 });
			await page.keyboard.press('Escape');
			await expect(summaryBar).toBeHidden();

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

			// Back on the event: the tier list stays reachable (Task 10b's
			// can_purchase_more-gated render) and the stepper's max hint has
			// SHRUNK from 3 to 1 — the remaining per-user allowance.
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);
			await expect(tierHeading).toBeVisible();
			await expect(stepper).toBeVisible({ timeout: 15_000 });
			await addButton.click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');
			await expect(stepper.getByText('(max 1)')).toBeVisible();
			await expect(addButton).toBeDisabled();

			// One more purchase (names required again, even at quantity 1)
			// exhausts the 3/3 cap.
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible();
			await sheet.getByLabel('Name for ticket 1').fill('E2E Guest Three');
			await expect(async () => {
				if (await success.isVisible()) return;
				await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
				await expect(success).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 40_000 });
			await page.keyboard.press('Escape');

			// Limit exhausted (3/3): the backend's can_purchase_more flips false,
			// so the tier list unmounts entirely and the sidebar's buy-more CTA
			// is gone too — the buy affordance is gone for good.
			await expect(async () => {
				await gotoHydrated(page, event.path);
				await expect(
					page.getByRole('button', { name: 'Show Tickets (3)' }).filter({ visible: true }).first()
				).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 30_000 });
			await expect(tierHeading).toBeHidden();
			await expect(page.getByRole('button', { name: 'Buy More Tickets' })).toBeHidden();
		} finally {
			await context.close();
		}
	});
});
