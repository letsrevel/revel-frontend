import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 (#753) — nameless checkout on an event whose `require_ticket_names` is
// OFF: the confirmation dialog still offers the quantity stepper, but the
// per-ticket holder-name inputs that batch-purchase.spec.ts asserts on are
// gone, and a 2-ticket claim goes through without a single name. The buyer
// then sets a real holder name after the fact from the my-tickets modal
// ("Rename holder" → rename dialog) — the other half of the flag's promise.
//
// "Nameless" is about the CHECKOUT, not the stored ticket: the backend fills
// an omitted guest_name with the buyer's own profile name, so the tickets
// arrive named and the modal's button reads "Rename holder" (see the comment
// at that click).
//
// #853 rewrite (wave 2, task 11 blast-radius fix): outside every prior wave's
// assigned file list, structurally broken by the `TicketTierModal`/
// `TicketConfirmationDialog` deletion until the full matrix gate caught it
// here (see free-tier.spec.ts's header for the shared rationale). The 'Group
// Entry' tier is `quickBuyEligible` — its inline stepper replaces the tier
// dialog's quantity selector, and since this event's `require_ticket_names`
// is OFF and the tier is neither PWYC nor best_available, `EventCart.needsSheet`
// stays false — Buy goes straight to claim, same as before, just with no
// sheet to assert "no name inputs" on (the checkout sheet never mounts at all
// for this cart).
//
// Isolation: an own event (the flag changes checkout's shape) plus a
// throwaway buyer (tickets consume the per-user tier limit); the auto
// "General Admission" tier is dropped so the arranged tier is the only
// claimable one.

test.describe('J6 nameless checkout @p1', () => {
	test('claims two tickets with no name inputs, then adds a holder name later', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { require_ticket_names: false } }),
			createVerifiedUser('Nameless')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Group Entry',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			max_tickets_per_user: 3
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			// Inline stepper: take 2 of the 3 allowed. The "Remove one" button
			// becoming enabled proves the click actually registered — without
			// that discriminator a dropped click would leave quantity at 1, where
			// BOTH negative assertions below pass vacuously (a checkout sheet only
			// ever mounts for require_ticket_names/pwyc/best_available carts).
			const stepper = page.getByRole('group', { name: 'Quantity for Group Entry' });
			await expect(stepper).toBeVisible({ timeout: 15_000 });
			const addButton = stepper.getByRole('button', { name: 'Add one Group Entry' });
			await addButton.click();
			await expect(stepper.getByRole('button', { name: 'Remove one Group Entry' })).toBeEnabled();
			await addButton.click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('2');

			// This event's require_ticket_names is OFF and the tier is neither
			// PWYC nor best_available, so EventCart.needsSheet stays false — no
			// checkout sheet mounts at all, hence no "Ticket holder names" block
			// or per-ticket name input anywhere on the page.
			await expect(page.getByText('Ticket holder names', { exact: true })).toBeHidden();
			await expect(page.getByLabel('Name for ticket 2')).toBeHidden();
			await expect(page.getByRole('dialog', { name: 'Checkout' })).toBeHidden();

			// Buy goes straight to claim (direct checkout, no sheet).
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			const summaryBar = page.getByTestId('cart-summary-bar');
			await expect(async () => {
				if (await success.isVisible()) return;
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(success).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 40_000 });
			await page.keyboard.press('Escape');

			// Dashboard: BOTH tickets land as individual Active cards — the count
			// is what proves the stepper's 2 made it into the claim (batch-purchase
			// asserts the same). Reload-retry because a silently unauthorized
			// my-tickets query renders the empty state instead of an error (issue
			// #596 item 1) and heals on a fresh load.
			const ticketCard = page
				.locator('article, li, div')
				.filter({ hasText: event.name })
				.filter({ hasText: /Active/i })
				.first();
			await expect(async () => {
				await gotoHydrated(page, '/dashboard/tickets');
				await waitForClientAuth(page);
				await expect(page.getByText('Showing 2 of 2')).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });
			await expect(ticketCard).toBeVisible();

			// The modal offers "Rename holder", NOT "Add holder name": the UI sent
			// no names at all (that is what the assertions above prove), but the
			// backend fills the blank with the buyer's own profile name
			// (`guest_name=item.guest_name or (preferred_name or get_full_name())`
			// in batch_ticket_service/tickets.py), so a logged-in buyer's tickets
			// are never truly nameless. Only email-only guests — who have no
			// dashboard — end up with a blank holder and the "Add holder name"
			// wording.
			//
			// `ticketCard` is a coarse container locator that can resolve to an
			// ancestor holding BOTH cards, so the button needs its own .first()
			// to stay strict-safe — unlike the single-ticket model specs.
			await ticketCard.getByRole('button', { name: 'View ticket and QR code' }).first().click();
			const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(modal).toBeVisible();

			const holderName = uniqueName('Holder');
			await modal.getByRole('button', { name: 'Rename holder' }).click();
			const renameDialog = page.getByRole('dialog', { name: 'Rename ticket holder' });
			await renameDialog.getByLabel('Holder name').fill(holderName);
			await renameDialog.getByRole('button', { name: 'Save' }).click();
			await expect(page.getByText('Ticket holder updated')).toBeVisible({ timeout: 10_000 });

			// Re-open the ticket from a CLOSED state rather than trusting the
			// still-open modal to live-update after the query invalidation. The
			// PATCH targeted the first card's ticket and card order is stable
			// across the refetch, so the same card carries the new name; the
			// Escape at the TOP of the loop body lets every retry re-enter from a
			// closed state instead of clicking into a dialog overlay.
			await expect(async () => {
				await page.keyboard.press('Escape');
				await ticketCard.getByRole('button', { name: 'View ticket and QR code' }).first().click();
				await expect(modal).toBeVisible({ timeout: 3_000 });
				await expect(modal.getByText(holderName)).toBeVisible({ timeout: 3_000 });
			}).toPass({ timeout: 30_000 });
		} finally {
			await context.close();
		}
	});
});
