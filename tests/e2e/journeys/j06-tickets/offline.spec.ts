import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6.5 (USER_JOURNEYS.md) — offline-payment tier: reserve → ticket is PENDING
// with the organizer's manual payment instructions → staff confirms the
// payment in the event admin → ticket flips ACTIVE for the buyer.
//
// #853 rewrite (wave 2, task 11 blast-radius fix): outside every prior wave's
// assigned file list, structurally broken by the `TicketTierModal`/
// `TicketConfirmationDialog` deletion until the full matrix gate caught it
// here (see free-tier.spec.ts's header for the shared rationale). The
// 'Bank Transfer' tier is `quickBuyEligible` — its inline stepper + the
// checkout sheet (names required by default) replace the dialog cluster; the
// sheet's payment-method button is "Reserve" for `offline` (`cartSheet.reserve`).
//
// Isolation: API-arranged event + offline tier + throwaway buyer; the seeded
// offline tiers (Workshop Seat, Standing Room) stay untouched.

const INSTRUCTIONS = 'Wire the amount to IBAN AT12 3456 7890 within 5 days.';

test.describe('J6 offline payment @p2', () => {
	test('reserve → pending with instructions → staff confirms → active', async ({
		browser,
		asOwner
	}) => {
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Offline')
		]);
		// The auto-created General Admission tier also renders "Reserve Ticket".
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Bank Transfer',
			payment_method: 'offline',
			price: '20.00',
			manual_payment_instructions: INSTRUCTIONS
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// Stepper → Buy → sheet (names required) → Reserve. Idempotent loop:
		// clicks during rerenders are occasionally dropped; success signal is
		// the auto-opened "Your Ticket" modal.
		const stepper = page.getByRole('group', { name: 'Quantity for Bank Transfer' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		await stepper.getByRole('button', { name: 'Add one Bank Transfer' }).click();
		await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(async () => {
			if (await sheet.isVisible()) return;
			await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
			await expect(sheet).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 30_000 });
		await sheet.getByLabel('Name for ticket 1').fill('E2E Offline Buyer');

		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(async () => {
			if (await success.isVisible()) return;
			await sheet.getByRole('button', { name: 'Reserve', exact: true }).click();
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// The ticket modal shows the pending-payment banner with the organizer's
		// manual instructions.
		await expect(success.getByText('Your ticket is pending payment')).toBeVisible();
		await expect(success.getByText('Payment Instructions:')).toBeVisible();
		await expect(success.getByText(INSTRUCTIONS)).toBeVisible();

		// Staff side: confirm the pending ticket via the row's actions menu.
		await gotoHydrated(asOwner, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(asOwner);
		const buyerRow = asOwner
			.locator('tr, article, li, div')
			.filter({ hasText: `${buyer.firstName} ${buyer.lastName}` })
			.filter({ hasText: /Pending/i })
			.first();
		await expect(buyerRow).toBeVisible({ timeout: 15_000 });
		// Confirm Payment is an INLINE row action, not an overflow-menu item: the
		// v2.4.0 rebalance (#834) moved Check In / Confirm payment / Refund /
		// Cancel onto the row and left only the rarer actions in the kebab.
		await buyerRow.getByRole('button', { name: 'Confirm Payment' }).first().click();

		const confirmPayment = asOwner.getByRole('dialog', { name: 'Confirm Payment' });
		await expect(confirmPayment).toBeVisible({ timeout: 15_000 });
		await confirmPayment.getByRole('button', { name: 'Confirm Payment' }).click();
		await expect(confirmPayment).not.toBeVisible({ timeout: 15_000 });

		const activeRow = asOwner
			.locator('tr, article, li, div')
			.filter({ hasText: `${buyer.firstName} ${buyer.lastName}` })
			.filter({ hasText: /Active/i })
			.first();
		await expect(activeRow).toBeVisible({ timeout: 15_000 });

		// Buyer side: the dashboard ticket flipped to Active.
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
});
