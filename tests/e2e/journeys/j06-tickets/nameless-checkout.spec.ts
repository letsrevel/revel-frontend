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
// then names one of those tickets after the fact from the my-tickets modal
// ("Add holder name" → rename dialog) — the other half of the flag's promise.
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

			// Tier dialog → confirmation dialog with the quantity stepper. Run as
			// an idempotent loop: clicks during dialog re-renders are occasionally
			// dropped (same shape as batch-purchase.spec.ts).
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

			// Take 2 of the 3 allowed. With names required this would reveal the
			// "Ticket Holders" block and a "Guest 2 name" input — with the flag
			// off neither may appear.
			await page.getByRole('button', { name: 'Increase quantity' }).click();
			await expect(page.getByText('Ticket Holders', { exact: true })).toBeHidden();
			await expect(page.getByPlaceholder('Guest 2 name')).toBeHidden();

			// `exact` matters: a substring match on "Your Ticket" also hits the
			// "Select Your Ticket" tier dialog.
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			const claim = page.getByRole('button', { name: 'Claim Ticket', exact: true });
			await expect(async () => {
				if (await success.isVisible()) return;
				await claim.click();
				await expect(success).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 40_000 });
			await page.keyboard.press('Escape');

			// Dashboard: both tickets land as individual Active cards. Reload-retry
			// because a silently unauthorized my-tickets query renders the empty
			// state instead of an error (issue #596 item 1) and heals on a fresh
			// load.
			const ticketCard = page
				.locator('article, li, div')
				.filter({ hasText: event.name })
				.filter({ hasText: /Active/i })
				.first();
			await expect(async () => {
				await gotoHydrated(page, '/dashboard/tickets');
				await waitForClientAuth(page);
				await expect(ticketCard).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });

			// The ticket is nameless, so the modal offers "Add holder name"
			// (a named one would read "Rename holder").
			await ticketCard.getByRole('button', { name: 'View ticket and QR code' }).click();
			const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(modal).toBeVisible();

			const holderName = uniqueName('Holder');
			await modal.getByRole('button', { name: 'Add holder name' }).click();
			const renameDialog = page.getByRole('dialog', { name: 'Rename ticket holder' });
			await renameDialog.getByLabel('Holder name').fill(holderName);
			await renameDialog.getByRole('button', { name: 'Save' }).click();
			await expect(page.getByText('Ticket holder updated')).toBeVisible({ timeout: 10_000 });

			// The name is on the ticket: the rename invalidates dashboard-tickets
			// and the still-open modal re-reads the refreshed card.
			await expect(modal.getByText(holderName)).toBeVisible({ timeout: 15_000 });
		} finally {
			await context.close();
		}
	});
});
