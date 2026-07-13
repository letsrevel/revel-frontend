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
// - PWYC enforces its min/max range in the confirmation dialog and carries
//   the chosen amount; exercised on BOTH manual payment methods —
//   at_the_door (→ ACTIVE) and offline (→ PENDING + instructions).
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

// Reserve-flow idempotent loop (same shape as free-tier.spec.ts): clicks
// during dialog re-renders are occasionally dropped, so retry from whatever
// state the UI is in. `beforeConfirm` runs whenever the confirm dialog is
// open (PWYC amount fill — re-runs harmlessly on retries).
async function reserveTicket(page: Page, beforeConfirm?: (dialog: Locator) => Promise<void>) {
	const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
	const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
	const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	await expect(async () => {
		if (await success.isVisible()) return;
		if (!(await confirmDialog.isVisible())) {
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
		}
		await beforeConfirm?.(confirmDialog);
		await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
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
		const success = await reserveTicket(page);

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

		// Open the confirm dialog once to exercise the range validation before
		// completing the reservation inside the idempotent loop.
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		const amount = confirmDialog.getByLabel('Payment Amount');
		await amount.fill('2');
		await expect(confirmDialog.getByText(/Amount must be at least EUR 5\.00/)).toBeVisible();
		await amount.fill('100');
		await expect(confirmDialog.getByText(/Amount cannot exceed EUR 50\.00/)).toBeVisible();

		const success = await reserveTicket(page, async (dialog) => {
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
		const success = await reserveTicket(page, async (dialog) => {
			await dialog.getByLabel('Payment Amount').fill('7.50');
		});

		// Offline stays PENDING until staff confirm, and surfaces the
		// organizer's payment instructions.
		await expect(success.getByText('Your ticket is pending payment')).toBeVisible();
		await expect(success.getByText('Send your chosen amount to IBAN AT98 7654.')).toBeVisible();

		await context.close();
	});
});
