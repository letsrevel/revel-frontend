import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Browser } from '@playwright/test';

// #853 follow-up — the sidebar "Get Tickets" CTA opens a focused tiers
// dialog hosting the same TicketTierList render as the inline section
// (shared cart, one snippet), instead of scrolling to the bottom of the
// page. The dialog footer mirrors CartSummaryBar, and its Buy closes the
// dialog before handing off to the same checkout flow the bar uses.

async function openBuyerPage(browser: Browser, path: string) {
	const buyer = await createVerifiedUser('TiersDialog');
	const context = await browser.newContext();
	await authenticateContext(context, buyer);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return { context, page };
}

async function arrangeOfflineEvent() {
	const event = await createTicketedEvent({
		freeTier: false,
		event: { require_ticket_names: false }
	});
	await deleteDefaultTier(event.id);
	const tier = await createTicketTier(event.id, {
		name: 'Dialog Tier',
		payment_method: 'offline',
		price: '10.00',
		price_type: 'fixed',
		seat_assignment_mode: 'none',
		total_quantity: 50
	});
	return { event, tier };
}

test.describe('J6 tiers dialog @p1', () => {
	test('sidebar CTA opens the dialog; stepper + footer buy → pending tickets', async ({
		browser
	}) => {
		const { event, tier } = await arrangeOfflineEvent();
		const { context, page } = await openBuyerPage(browser, event.path);

		await page
			.getByRole('button', { name: 'Get Tickets', exact: true })
			.filter({ visible: true })
			.first()
			.click();

		const dialog = page.getByTestId('ticket-tiers-dialog');
		await expect(dialog).toBeVisible();

		// The dialog hosts the same steppers as the inline list.
		const stepper = dialog.getByRole('group', { name: `Quantity for ${tier.name}` });
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		// Footer mirrors the summary bar: count · total.
		await expect(dialog).toContainText('1 ticket');
		await expect(dialog).toContainText('EUR 10.00');

		// Buy closes the dialog and hands off to the same offline checkout
		// as CartSummaryBar (PENDING tickets + "reserved" toast, no Stripe).
		await dialog.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('dialog', { name: 'Your Ticket', exact: true })).toBeVisible({
			timeout: 8_000
		});

		await context.close();
	});

	test('dismissing the dialog keeps the selection: summary bar takes over', async ({ browser }) => {
		const { event, tier } = await arrangeOfflineEvent();
		const { context, page } = await openBuyerPage(browser, event.path);

		await page
			.getByRole('button', { name: 'Get Tickets', exact: true })
			.filter({ visible: true })
			.first()
			.click();

		const dialog = page.getByTestId('ticket-tiers-dialog');
		const stepper = dialog.getByRole('group', { name: `Quantity for ${tier.name}` });
		await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		// Escape closes the dialog without buying — the cart survives (it
		// lives on the page, not in the dialog) and the sticky bar shows it.
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		const summaryBar = page.getByTestId('cart-summary-bar');
		await expect(summaryBar).toBeVisible();
		await expect(summaryBar).toContainText('1 ticket');
		await expect(summaryBar).toContainText('EUR 10.00');

		await context.close();
	});
});
