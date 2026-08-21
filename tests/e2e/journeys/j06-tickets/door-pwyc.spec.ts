import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Browser, Locator, Page } from '@playwright/test';

// J6.4/J6.5 (USER_JOURNEYS.md) — at-the-door and pay-what-you-can tiers:
// - at_the_door checkout creates an immediately ACTIVE ticket (payment is
//   collected on arrival; no staff confirmation gate, unlike offline).
// - PWYC enforces its min/max range in the checkout sheet and carries
//   the chosen amount; exercised on BOTH manual payment methods —
//   at_the_door (→ ACTIVE) and offline (→ PENDING + instructions).
//
// #853 rewrite (wave 2, task 11 blast-radius fix): outside every prior wave's
// assigned file list, structurally broken by the `TicketTierModal`/
// `TicketConfirmationDialog` deletion until the full matrix gate caught it
// here (see free-tier.spec.ts's header for the shared rationale). Both
// payment methods are `quickBuyEligible` — the inline stepper replaces the
// tier dialog, and a PWYC tier always forces the checkout sheet open
// (`EventCart.needsSheet` — pwyc is unconditional, unlike `require_ticket_names`).
// The min/max copy also moved: the sheet's inline+footer validation both use
// `pwycErrorMessage` ("Minimum/Maximum amount is {amount}"), not the old
// dialog's "Amount must be at least/cannot exceed" hint text.
//
// Isolation: each test API-arranges its own event + tier + throwaway buyer.

async function openBuyerPage(browser: Browser, path: string) {
	const buyer = await createVerifiedUser('DoorPwyc');
	const context = await browser.newContext();
	await authenticateContext(context, buyer);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return { context, page };
}

/**
 * Bump `tierName`'s inline stepper to 1, open the sheet via the cart summary
 * bar, run `beforeConfirm` (PWYC amount fill — re-runs harmlessly on
 * retries), then Reserve. Idempotent loop throughout: clicks during
 * rerenders are occasionally dropped, so retry from whatever state the UI is
 * in.
 */
async function reserveTicket(
	page: Page,
	tierName: string,
	beforeConfirm?: (sheet: Locator) => Promise<void>
) {
	const stepper = page.getByRole('group', { name: `Quantity for ${tierName}` });
	await expect(stepper).toBeVisible({ timeout: 15_000 });
	const addButton = stepper.getByRole('button', { name: `Add one ${tierName}` });
	await expect(async () => {
		if ((await stepper.locator('span[aria-live="polite"]').textContent()) !== '0') return;
		await addButton.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1', { timeout: 5_000 });
	}).toPass({ timeout: 30_000 });

	const summaryBar = page.getByTestId('cart-summary-bar');
	const sheet = page.getByRole('dialog', { name: 'Checkout' });
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	await expect(async () => {
		if (await success.isVisible()) return;
		if (!(await sheet.isVisible())) {
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible({ timeout: 8_000 });
		}
		// Names are required by default (these events never set
		// require_ticket_names: false) — the sheet never prefills ticket 1.
		await sheet.getByLabel('Name for ticket 1').fill('E2E Door Buyer');
		await beforeConfirm?.(sheet);
		await sheet.getByRole('button', { name: 'Reserve', exact: true }).click();
		await expect(success).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 60_000 });
	return success;
}

test.describe('J6 at-the-door & PWYC @p2', () => {
	test('at-the-door fixed price → ticket is active immediately', async ({ browser }) => {
		const event = await createTicketedEvent({ freeTier: false });
		await deleteDefaultTier(event.id); // its card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			name: 'At The Door',
			payment_method: 'at_the_door',
			price: '15.00'
		});

		const { context, page } = await openBuyerPage(browser, event.path);
		const success = await reserveTicket(page, 'At The Door');

		// ACTIVE straight away — no pending-payment banner, no staff gate.
		await expect(success.getByText('Active', { exact: true }).first()).toBeVisible();
		await expect(success.getByText('Your ticket is pending payment')).not.toBeVisible();

		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(activeCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		await context.close();
	});

	test('PWYC at-the-door enforces min/max and activates at the chosen amount', async ({
		browser
	}) => {
		const event = await createTicketedEvent({ freeTier: false });
		await deleteDefaultTier(event.id); // its card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			name: 'Door PWYC',
			payment_method: 'at_the_door',
			price_type: 'pwyc',
			price: '10.00',
			pwyc_min: '5.00',
			pwyc_max: '50.00'
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		// Bump the stepper and open the sheet once to exercise the range
		// validation before completing the reservation inside the idempotent
		// loop. A PWYC tier forces the sheet open regardless of
		// require_ticket_names.
		const stepper = page.getByRole('group', { name: 'Quantity for Door PWYC' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(async () => {
			if (await sheet.isVisible()) return;
			if ((await stepper.locator('span[aria-live="polite"]').textContent()) === '0') {
				await stepper.getByRole('button', { name: 'Add one Door PWYC' }).click();
			}
			const summaryBar = page.getByTestId('cart-summary-bar');
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 30_000 });

		// Min/max validation uses pwycErrorMessage's copy ("Minimum/Maximum
		// amount is {amount}"), rendered both as the field's inline alert and
		// the sheet's footer hint.
		const amount = sheet.getByLabel('Payment Amount');
		await amount.fill('2');
		await expect(sheet.getByText(/Minimum amount is EUR 5\.00/).first()).toBeVisible();
		await amount.fill('100');
		await expect(sheet.getByText(/Maximum amount is EUR 50\.00/).first()).toBeVisible();

		const success = await reserveTicket(page, 'Door PWYC', async (dialog) => {
			await dialog.getByLabel('Payment Amount').fill('12.50');
		});
		await expect(success.getByText('Active', { exact: true }).first()).toBeVisible();

		await context.close();
	});

	test('PWYC offline reserves a pending ticket at the chosen amount', async ({ browser }) => {
		const event = await createTicketedEvent({ freeTier: false });
		await deleteDefaultTier(event.id); // its card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			name: 'Transfer PWYC',
			payment_method: 'offline',
			price_type: 'pwyc',
			price: '10.00',
			pwyc_min: '5.00',
			pwyc_max: '50.00',
			manual_payment_instructions: 'Send your chosen amount to IBAN AT98 7654.'
		});

		const { context, page } = await openBuyerPage(browser, event.path);
		const success = await reserveTicket(page, 'Transfer PWYC', async (dialog) => {
			await dialog.getByLabel('Payment Amount').fill('7.50');
		});

		// Offline stays PENDING until staff confirm, and surfaces the
		// organizer's payment instructions.
		await expect(success.getByText('Your ticket is pending payment')).toBeVisible();
		await expect(success.getByText('Send your chosen amount to IBAN AT98 7654.')).toBeVisible();

		await context.close();
	});
});
