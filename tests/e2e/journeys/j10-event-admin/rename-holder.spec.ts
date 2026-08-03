import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	uniqueName
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 (#753) — admin holder rename + holder-name search. The organizer renames
// a ticket's holder from the row's kebab menu; the row then shows the holder
// name with the purchaser underneath, and the backend's guest_name search finds
// the ticket by its NEW holder name.
//
// On the "(Purchased by …)" line: the row renders it whenever guest_name
// differs from the purchaser's display name (`getGuestNameIfDifferent`).
// claimTicketViaApi seeds guest_name with the buyer's OWN full name and
// register leaves `preferred_name` blank, so the two match and the line is
// absent until this spec renames the holder.
//
// Isolation: an own event with an offline tier (its tickets stay PENDING, so
// they remain renamable — the backend 409s once checked in or cancelled) plus
// a throwaway buyer, because a rename mutates a ticket row other suites
// assert on.

test.describe('J10 rename ticket holder @p1', () => {
	test('renames from the row menu and finds the ticket by holder name', async ({ asOwner }) => {
		test.setTimeout(120_000);

		const event = await createTicketedEvent({ freeTier: false });
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Offline Tier',
			payment_method: 'offline',
			price: '15.00'
		});
		const buyer = await createVerifiedUser('RenameBuyer');
		await claimTicketViaApi(buyer, event.id, tier.id);
		const buyerName = `${buyer.firstName} ${buyer.lastName}`;
		const holderName = uniqueName('NewHolder');

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();
		await expect(page.getByText(buyerName).filter({ visible: true }).first()).toBeVisible({
			timeout: 15_000
		});

		// Both the desktop table and the mobile card list are in the DOM, so
		// every row affordance matches twice — scope to the visible one.
		const holderCell = page.getByText(holderName).filter({ visible: true });

		// Rename via the row kebab. Its aria-label carries the PURCHASER's name
		// and does not change with the holder, so the loop can retry from either
		// state (menu clicks during re-renders are occasionally dropped — same
		// shape as manage-tickets.spec.ts).
		await expect(async () => {
			if (!(await holderCell.first().isVisible())) {
				await page
					.getByRole('button', { name: `More actions for ${buyerName}` })
					.filter({ visible: true })
					.first()
					.click({ timeout: 3_000 });
				await page.getByRole('menuitem', { name: 'Rename holder' }).click({ timeout: 3_000 });
				const dialog = page.getByRole('dialog', { name: 'Rename ticket holder' });
				await dialog.getByLabel('Holder name').fill(holderName);
				await dialog.getByRole('button', { name: 'Save' }).click({ timeout: 3_000 });
			}
			await expect(holderCell.first()).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 60_000 });

		// Holder and purchaser are both on the row now.
		await expect(
			page.getByText(`(Purchased by ${buyerName})`).filter({ visible: true }).first()
		).toBeVisible();

		// Backend search matches guest_name (server-side, URL-driven). Garbage
		// query FIRST: the row is already on screen, so asserting the holder-name
		// query while it is still visible would pass without the query ever
		// round-tripping. Emptying the list first makes the match meaningful.
		const search = page.getByPlaceholder('Search by holder, purchaser, email, or tier...');
		await search.fill('zzz-no-such-holder');
		await expect(holderCell).toHaveCount(0, { timeout: 15_000 });
		await search.fill(holderName);
		await expect(holderCell.first()).toBeVisible({ timeout: 15_000 });
	});
});
