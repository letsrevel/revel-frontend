import crypto from 'node:crypto';
import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J20 (USER_JOURNEYS.md) — discount code lifecycle: admin creates a
// percentage code → buyer applies it at checkout (invalid codes rejected
// inline) → the discounted price shows and the reservation records the
// usage → duplicate code creation 409s → deleting a USED code deactivates
// it instead (redemption history preserved).
//
// The buyer side uses an OFFLINE tier: usage is recorded at ticket creation
// (batch_ticket_service.apply_discount), so no Stripe round-trip is needed.
//
// Isolation: own event + tier + throwaway buyer on Org Alpha; the code name
// is run-unique so re-runs never collide with previous (deactivated) codes.

const CODE = `E2E${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const ADMIN_LIST = '/org/revel-events-collective/admin/discount-codes';

/**
 * The admin list renders the code twice (desktop table + mobile cards, one
 * hidden per viewport) — the deepest VISIBLE container holding both the code
 * and the expected text is the real row/card (ancestors precede descendants
 * in locator order, so .last() is the deepest).
 */
function codeRowWith(page: import('@playwright/test').Page, text: string) {
	return page
		.locator('tr, article, li, div')
		.filter({ hasText: CODE })
		.filter({ hasText: text })
		.filter({ visible: true })
		.last();
}

test.describe('J20 discount lifecycle @p2', () => {
	test('create → apply at checkout → usage tracked → duplicate 409 → used delete deactivates', async ({
		asOwner,
		browser
	}) => {
		const [event, buyer] = await Promise.all([
			// Names off: the sheet is entered via the summary bar's discount link,
			// and the discount round-trip shouldn't be confounded by the unrelated
			// holder-name validation gate.
			createTicketedEvent({ freeTier: false, event: { require_ticket_names: false } }),
			createVerifiedUser('Discount')
		]);
		await deleteDefaultTier(event.id); // its card also renders a stepper
		await createTicketTier(event.id, {
			name: 'Discountable Entry',
			payment_method: 'offline',
			price: '20.00'
		});

		// Admin creates a 50% org-wide code through the form.
		await gotoHydrated(asOwner, `${ADMIN_LIST}/new`);
		await waitForClientAuth(asOwner);
		await asOwner.getByLabel('Code', { exact: true }).fill(CODE);
		await asOwner.getByRole('radio', { name: /Percentage/ }).check();
		await asOwner.getByLabel('Discount Value').fill('50');
		await asOwner.getByRole('button', { name: 'Create Discount Code' }).click();
		await asOwner.waitForURL(/admin\/discount-codes(?:\?|$)/, { timeout: 15_000 });

		await expect(codeRowWith(asOwner, '0 / ∞')).toBeVisible({ timeout: 15_000 });

		// Buyer: invalid code rejected inline, real code halves the price.
		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// Cart flow (#853): one ticket via the tier stepper, then the summary
		// bar's "Discount code?" link opens the checkout sheet (this cart needs
		// no other input, so Buy alone would checkout directly).
		const stepper = page.getByRole('group', { name: 'Quantity for Discountable Entry' });
		await stepper.getByRole('button', { name: 'Add one Discountable Entry' }).click();
		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Discount code?' }).click();

		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		// Open the discount accordion; a bogus code gets the backend's per-group
		// "invalid" verdict in the results live-region.
		await sheet.getByRole('button', { name: 'Discount code' }).click();
		const codeInput = sheet.getByRole('textbox', { name: 'Discount code' });
		await codeInput.fill('E2ENOSUCHCODE');
		await sheet.getByRole('button', { name: 'Apply' }).click();
		const results = sheet.locator('[aria-live="polite"]');
		await expect(results.locator('p', { hasText: 'Discountable Entry' })).toContainText(
			/invalid discount code/i,
			{ timeout: 15_000 }
		);

		// The real code applies to the tier and halves the footer total (€20 → €10).
		await codeInput.fill(CODE);
		await sheet.getByRole('button', { name: 'Apply' }).click();
		await expect(results.getByText('Applies to Discountable Entry')).toBeVisible({
			timeout: 15_000
		});
		const footerTotal = sheet.locator('p', { hasText: 'Total' });
		await expect(footerTotal).toContainText('€10.00');

		// Reserve — usage is recorded as soon as the (pending) ticket exists.
		await sheet.getByRole('button', { name: 'Reserve', exact: true }).click();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(success).toBeVisible({ timeout: 8_000 });
		await context.close();

		await expect(async () => {
			await gotoHydrated(asOwner, ADMIN_LIST);
			await expect(codeRowWith(asOwner, '1 / ∞')).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		// Duplicate code → backend 409 rendered in the form's error alert.
		await gotoHydrated(asOwner, `${ADMIN_LIST}/new`);
		await waitForClientAuth(asOwner);
		await asOwner.getByLabel('Code', { exact: true }).fill(CODE);
		await asOwner.getByRole('radio', { name: /Percentage/ }).check();
		await asOwner.getByLabel('Discount Value').fill('25');
		await asOwner.getByRole('button', { name: 'Create Discount Code' }).click();
		await expect(asOwner.getByText('A discount code with this code already exists.')).toBeVisible({
			timeout: 15_000
		});

		// Deleting the used code deactivates it instead (native confirm()).
		await gotoHydrated(asOwner, ADMIN_LIST);
		await waitForClientAuth(asOwner);
		asOwner.once('dialog', (dialog) => dialog.accept());
		await asOwner
			.getByRole('button', { name: `Deactivate discount code ${CODE}` })
			.filter({ visible: true })
			.click();
		await expect(
			asOwner.getByText("Discount code deactivated (it has been used, so it can't be deleted).")
		).toBeVisible({ timeout: 15_000 });
		await expect(codeRowWith(asOwner, 'Inactive')).toBeVisible({ timeout: 15_000 });
	});
});
