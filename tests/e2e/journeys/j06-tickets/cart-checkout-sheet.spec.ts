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

// #853 (PR 2) — checkout sheet: the multi-group dialog that opens instead of
// a direct checkout whenever the cart needs input the steppers alone can't
// collect (`EventCart.needsSheet` — ticket-holder names on a
// require_ticket_names event, or a PWYC amount). PR 2 widened
// `quickBuyEligible` so PWYC and names-required tiers ALSO render a stepper
// (cart-quick-buy.spec.ts covers the no-sheet path for plain fixed-price
// tiers); the sheet is where those tiers actually get bought.
//
// All three scenarios use payment_method 'offline' — PENDING tickets + a
// "reserved" toast, no Stripe round-trip (same rationale as
// cart-quick-buy.spec.ts: 'at_the_door' skips the pending gate entirely, and
// Stripe/online is PR 4's payment matrix).
//
// Isolation: each test API-arranges its own event + tiers + throwaway buyer.

async function openBuyerPage(browser: Browser, path: string) {
	const buyer = await createVerifiedUser('CartCheckoutSheet');
	const context = await browser.newContext();
	await authenticateContext(context, buyer);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return { context, page };
}

test.describe('J6 cart checkout sheet @p1', () => {
	test('names-required cart: blank submit is blocked, filled names reserve two tickets', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: true }
		});
		await deleteDefaultTier(event.id); // its card also has a stepper

		const tier = await createTicketTier(event.id, {
			name: 'Named Entry',
			payment_method: 'offline',
			price: '10.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		const addButton = stepper.getByRole('button', { name: `Add one ${tier.name}` });

		await addButton.click();
		await expect(stepper.getByRole('button', { name: `Remove one ${tier.name}` })).toBeEnabled();
		await addButton.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

		// Checkout sheet opens instead of a direct checkout — this cart needs
		// per-ticket holder names.
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		const confirmButton = sheet.getByRole('button', { name: 'Reserve', exact: true });
		const nameError = sheet.getByText('Please enter a name for every ticket');
		const name1 = sheet.getByLabel('Name for ticket 1');
		const name2 = sheet.getByLabel('Name for ticket 2');
		await expect(name1).toBeVisible();
		await expect(name2).toBeVisible();

		// Blank state: the sheet starts with no names entered, so the footer's
		// nameRequired hint is already up and the confirm button is disabled —
		// there is no way to submit a blank cart.
		await expect(nameError).toBeVisible();
		await expect(confirmButton).toBeDisabled();

		// Filling only one of the two still leaves the cart invalid.
		await name1.fill('Ada Lovelace');
		await expect(nameError).toBeVisible();
		await expect(confirmButton).toBeDisabled();

		// Both filled: the hint clears and the confirm button unlocks.
		await name2.fill('Grace Hopper');
		await expect(nameError).toBeHidden();
		await expect(confirmButton).toBeEnabled();

		await confirmButton.click();

		// "Reserved" toast — offline creates PENDING tickets directly.
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

		// Sheet closes and the my-ticket modal auto-opens with both tickets.
		await expect(sheet).toBeHidden({ timeout: 8_000 });
		const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(modal).toBeVisible({ timeout: 8_000 });
		await expect(modal.getByText('2 pending payment')).toBeVisible();
		await expect(modal.getByText('Ticket 1 of 2')).toBeVisible();

		// Cart cleared: the summary bar disappears once the purchase completes.
		await page.keyboard.press('Escape');
		await expect(summaryBar).toBeHidden();

		await context.close();
	});

	test('PWYC + flat mixed cart: invalid amount blocks confirm, footer totals the mix', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);

		const pwycTier = await createTicketTier(event.id, {
			name: 'Sheet PWYC',
			payment_method: 'offline',
			price_type: 'pwyc',
			price: '5.00',
			pwyc_min: '5.00',
			pwyc_max: '50.00',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});
		const flatTier = await createTicketTier(event.id, {
			name: 'Sheet Flat',
			payment_method: 'offline',
			price: '12.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const pwycStepper = page.getByRole('group', { name: `Quantity for ${pwycTier.name}` });
		const flatStepper = page.getByRole('group', { name: `Quantity for ${flatTier.name}` });
		await pwycStepper.getByRole('button', { name: `Add one ${pwycTier.name}` }).click();
		await expect(pwycStepper.locator('span[aria-live="polite"]')).toHaveText('1');
		await flatStepper.getByRole('button', { name: `Add one ${flatTier.name}` }).click();
		await expect(flatStepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		const confirmButton = sheet.getByRole('button', { name: 'Reserve', exact: true });
		const amountInput = sheet.getByLabel('Payment Amount');

		// Empty PWYC amount blocks confirm from the start (no separate submit
		// click is needed to surface the footer hint).
		await expect(confirmButton).toBeDisabled();

		// Below the tier's minimum (5.00) — still blocked, with the precise
		// min-amount hint in the footer.
		await amountInput.fill('2');
		await expect(sheet.getByText('Minimum amount is EUR 5.00')).toBeVisible();
		await expect(confirmButton).toBeDisabled();

		// A valid amount unblocks confirm and the footer totals the mix:
		// 10.00 (PWYC) + 12.00 (flat) = 22.00.
		await amountInput.fill('10');
		await expect(sheet.getByText('Minimum amount is EUR 5.00')).toBeHidden();
		await expect(confirmButton).toBeEnabled();
		// Scoped to the footer's "Total" row specifically — the dialog
		// description above it renders the same total inline, and an
		// unscoped text match would hit both.
		const footerTotal = sheet.locator('p', { hasText: 'Total' });
		await expect(footerTotal).toContainText('€22.00');

		await confirmButton.click();

		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });
		await expect(sheet).toBeHidden({ timeout: 8_000 });
		const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(modal).toBeVisible({ timeout: 8_000 });
		await expect(modal.getByText('2 pending payment')).toBeVisible();
		await expect(modal.getByText('Ticket 1 of 2')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(summaryBar).toBeHidden();

		await context.close();
	});

	// No discount-code-creation factory exists yet (checked: `grep -rl
	// "discount" tests/e2e` finds only discount-lifecycle.spec.ts, which
	// creates its code through the admin UI, not an API factory) — this
	// exercises the "code doesn't match anything" path with a bogus code
	// instead of a real applied discount. COVERAGE GAP: the positive
	// discount-applies path (cartSheet.discountApplies + a discounted footer
	// total) is untested here; add it once an API discount-code factory
	// exists.
	test('discount feedback: bogus code reports per-group results, confirm still charges full price', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);

		// Discount-applicable: flat-priced, paid, unseated.
		const flatTier = await createTicketTier(event.id, {
			name: 'Discount Flat',
			payment_method: 'offline',
			price: '20.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});
		// NOT discount-applicable: PWYC tiers are excluded regardless of code
		// (cart-discount.ts's discountApplicable).
		const pwycTier = await createTicketTier(event.id, {
			name: 'Discount Pwyc',
			payment_method: 'offline',
			price_type: 'pwyc',
			price: '5.00',
			pwyc_min: '5.00',
			pwyc_max: '50.00',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const flatStepper = page.getByRole('group', { name: `Quantity for ${flatTier.name}` });
		const pwycStepper = page.getByRole('group', { name: `Quantity for ${pwycTier.name}` });
		await flatStepper.getByRole('button', { name: `Add one ${flatTier.name}` }).click();
		await expect(flatStepper.locator('span[aria-live="polite"]')).toHaveText('1');
		await pwycStepper.getByRole('button', { name: `Add one ${pwycTier.name}` }).click();
		await expect(pwycStepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();

		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		// Fill the PWYC amount first so the discount round-trip below isn't
		// confounded by the unrelated PWYC validation gate.
		await sheet.getByLabel('Payment Amount').fill('10');

		// Open the discount accordion and apply a bogus code.
		await sheet.getByRole('button', { name: 'Discount code' }).click();
		const discountInput = sheet.getByRole('textbox', { name: 'Discount code' });
		await discountInput.fill('NOPECODE99');
		await sheet.getByRole('button', { name: 'Apply' }).click();

		// Per-group feedback, scoped to the discount results' single
		// aria-live="polite" region: the applicable flat tier gets the
		// backend's "invalid code" message, the PWYC tier gets the
		// not-applicable message — proving the fan-out is genuinely per-tier,
		// not a single cart-wide verdict.
		const results = sheet.locator('[aria-live="polite"]');
		await expect(results.locator('p', { hasText: flatTier.name })).toContainText(
			/invalid discount code/i,
			{ timeout: 10_000 }
		);
		await expect(results.locator('p', { hasText: pwycTier.name })).toContainText(
			"Doesn't apply to this ticket type"
		);

		// No discount applied: confirm is still allowed, at the full
		// undiscounted total (20.00 flat + 10.00 PWYC = 30.00).
		const confirmButton = sheet.getByRole('button', { name: 'Reserve', exact: true });
		await expect(confirmButton).toBeEnabled();
		const footerTotal = sheet.locator('p', { hasText: 'Total' });
		await expect(footerTotal).toContainText('€30.00');

		await confirmButton.click();

		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });
		await expect(sheet).toBeHidden({ timeout: 8_000 });
		const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(modal).toBeVisible({ timeout: 8_000 });
		await expect(modal.getByText('2 pending payment')).toBeVisible();
		await expect(modal.getByText('Ticket 1 of 2')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(summaryBar).toBeHidden();

		await context.close();
	});
});
