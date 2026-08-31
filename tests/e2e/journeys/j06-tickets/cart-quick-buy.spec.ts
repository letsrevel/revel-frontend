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

// #853 (PR 1) — quick-buy cart: fixed-price, seat_assignment_mode: 'none'
// tiers on an event with require_ticket_names OFF render an inline quantity
// stepper instead of the buy dialog, and a sticky CartSummaryBar totals the
// selection across tiers. Buying an offline cart skips Stripe entirely — it
// creates PENDING tickets directly from the multi-tier checkout endpoint,
// fires the "reserved" toast, and auto-opens the my-ticket modal.
//
// Stripe's online path is out of scope here (lands with PR 4's full payment
// matrix per the design spec) — both tiers below use payment_method
// 'offline' so the whole flow stays off Stripe. (NOT 'at_the_door': per
// ticket_service.py's status map that method creates tickets already ACTIVE
// — no staff confirmation gate — so it never produces the PENDING/"reserved"
// outcome this scenario is testing. 'offline' is the manual-payment method
// that actually stays PENDING until staff confirm.)
//
// Isolation: each test API-arranges its own event + tiers + throwaway buyer
// (same shape as door-pwyc.spec.ts / nameless-checkout.spec.ts).

async function openBuyerPage(browser: Browser, path: string) {
	const buyer = await createVerifiedUser('CartQuickBuy');
	const context = await browser.newContext();
	await authenticateContext(context, buyer);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return { context, page };
}

test.describe('J6 cart quick-buy @p1', () => {
	test('mixed-quantity offline cart: steppers, summary total, buy → 3 pending tickets', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false }
		});
		await deleteDefaultTier(event.id); // its card also has a stepper

		const tierA = await createTicketTier(event.id, {
			name: 'Quick Buy A',
			payment_method: 'offline',
			price: '10.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});
		const tierB = await createTicketTier(event.id, {
			name: 'Quick Buy B',
			payment_method: 'offline',
			price: '15.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const stepperA = page.getByRole('group', { name: `Quantity for ${tierA.name}` });
		const stepperB = page.getByRole('group', { name: `Quantity for ${tierB.name}` });
		const addA = stepperA.getByRole('button', { name: `Add one ${tierA.name}` });
		const addB = stepperB.getByRole('button', { name: `Add one ${tierB.name}` });

		// Two of tier A: the "Remove one" button becoming enabled proves the
		// click actually registered (same discriminator as nameless-checkout —
		// a dropped click would leave quantity at 0/1 and the count assertion
		// below would still pass vacuously otherwise).
		await addA.click();
		await expect(stepperA.getByRole('button', { name: `Remove one ${tierA.name}` })).toBeEnabled();
		await addA.click();
		await expect(stepperA.locator('span[aria-live="polite"]')).toHaveText('2');

		// One of tier B — a different tier, proving the cart aggregates across
		// tiers rather than tracking a single stepper.
		await addB.click();
		await expect(stepperB.locator('span[aria-live="polite"]')).toHaveText('1');

		// Summary bar: 3 tickets total, EUR 35.00 (2×10.00 + 1×15.00).
		const summaryBar = page.getByTestId('cart-summary-bar');
		await expect(summaryBar).toBeVisible();
		await expect(summaryBar).toContainText('3 tickets');
		await expect(summaryBar).toContainText('EUR 35.00');

		const buyButton = summaryBar.getByRole('button', { name: 'Buy', exact: true });
		await buyButton.click();

		// "Reserved" toast — offline creates PENDING tickets directly (no
		// Stripe redirect).
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

		// My-ticket modal auto-opens ~500ms after the success toast.
		const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(modal).toBeVisible({ timeout: 8_000 });
		await expect(modal.getByText('3 pending payment')).toBeVisible();
		await expect(modal.getByText('Ticket 1 of 3')).toBeVisible();

		// Cart cleared: the summary bar (rendered only while the cart is
		// non-empty) disappears once the purchase completes.
		await page.keyboard.press('Escape');
		await expect(summaryBar).toBeHidden();

		await context.close();
	});

	test('buy-more: tier list stays put after a purchase, second stepper buy adds to combined tickets', async ({
		browser
	}) => {
		// Regression coverage for #853: TicketTierModal's removal left
		// ticket-holders with no re-entry point into the tier list. The page
		// gate now also renders it when the backend still allows more
		// purchases — this exercises that path end to end.
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);

		const tier = await createTicketTier(event.id, {
			name: 'Buy More Entry',
			payment_method: 'offline',
			price: '10.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const tierHeading = page.getByRole('heading', { name: 'Ticket Options' });
		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		const addButton = stepper.getByRole('button', { name: `Add one ${tier.name}` });
		const summaryBar = page.getByTestId('cart-summary-bar');
		const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });

		// First purchase: one ticket.
		await addButton.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });
		await expect(modal).toBeVisible({ timeout: 8_000 });
		// A single ticket has no summary badge (that only appears once there are
		// multiple, or an online pending group) — the per-ticket banner is the
		// signal here.
		await expect(modal.getByText('Your ticket is pending payment')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(summaryBar).toBeHidden();

		// The regression: the tier list must still be here (or back) for the
		// ticket-holder — not unmounted now that `userTicket` is truthy.
		await expect(tierHeading).toBeVisible();
		await expect(addButton).toBeVisible();
		await expect(addButton).toBeEnabled();

		// Second purchase via the same stepper, proving buy-more actually works
		// end to end (not just that the section is visible).
		await addButton.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');
		await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
		await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 10_000 });

		// My-ticket modal now lists both tickets combined.
		await expect(modal).toBeVisible({ timeout: 8_000 });
		await expect(modal.getByText('2 pending payment')).toBeVisible();
		await expect(modal.getByText('Ticket 1 of 2')).toBeVisible();

		await context.close();
	});

	test('event per-person cap: filling it on one tier explains the dead stepper on another', async ({
		browser
	}) => {
		// When the event-level max_tickets_per_user is consumed by the cart,
		// OTHER tiers' steppers drop to max 0 — previously a dead "+" button
		// with no copy. The card now replaces the stepper with the event-limit
		// hint, and restores it when room frees up.
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false, max_tickets_per_user: 1 }
		});
		await deleteDefaultTier(event.id);

		const tierA = await createTicketTier(event.id, {
			name: 'Limit A',
			payment_method: 'offline',
			price: '10.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});
		const tierB = await createTicketTier(event.id, {
			name: 'Limit B',
			payment_method: 'offline',
			price: '15.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 50
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const stepperA = page.getByRole('group', { name: `Quantity for ${tierA.name}` });
		const stepperB = page.getByRole('group', { name: `Quantity for ${tierB.name}` });
		const hint = page.getByText("You've reached this event's ticket limit per person.");

		// With room in the cap, both steppers render and no hint shows.
		await expect(stepperB).toBeVisible();
		await expect(hint).toBeHidden();

		await stepperA.getByRole('button', { name: `Add one ${tierA.name}` }).click();
		await expect(stepperA.locator('span[aria-live="polite"]')).toHaveText('1');

		// Tier B's stepper is replaced by the explanatory hint, not left as a
		// dead control; tier A keeps its own stepper so the cart stays editable.
		await expect(hint).toBeVisible();
		await expect(stepperB).toHaveCount(0);
		await expect(stepperA).toBeVisible();

		// Freeing the slot restores tier B's stepper and clears the hint.
		await stepperA.getByRole('button', { name: `Remove one ${tierA.name}` }).click();
		await expect(stepperB).toBeVisible();
		await expect(hint).toBeHidden();

		await context.close();
	});

	test('stepper caps at total_available: a 2-ticket tier refuses a third add', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: false }
		});
		await deleteDefaultTier(event.id);

		const tier = await createTicketTier(event.id, {
			name: 'Capped Door Entry',
			payment_method: 'at_the_door',
			price: '5.00',
			price_type: 'fixed',
			seat_assignment_mode: 'none',
			total_quantity: 2
		});

		const { context, page } = await openBuyerPage(browser, event.path);

		const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
		const addButton = stepper.getByRole('button', { name: `Add one ${tier.name}` });

		await addButton.click();
		await addButton.click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

		// Capped at total_available (2): the add button disables rather than
		// letting a third click overshoot inventory.
		await expect(addButton).toBeDisabled();

		await context.close();
	});
});
