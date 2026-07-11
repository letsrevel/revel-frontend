import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10.4 (USER_JOURNEYS.md) — admin ticket management: list, search, sort,
// payment status updates (confirm → revert), admin cancel.
//
// Deviation from the spec's "seed (festival tickets)": tickets are arranged
// on an OWN event (offline tier → PENDING tickets) so statuses are
// deterministic and other suites' mutations can't interfere. There is no
// manual ticket-creation UI (granting is done via invitations), so that
// sub-journey is out of scope here.

test.describe('J10 manage tickets @p1', () => {
	test('search, sort, confirm/revert payment, cancel ticket', async ({ asOwner, isMobile }) => {
		test.setTimeout(120_000);
		const event = await createTicketedEvent({ freeTier: false });
		const tier = await createTicketTier(event.id, {
			name: 'Offline Tier',
			payment_method: 'offline',
			price: '15.00'
		});
		const [alpha, beta] = await Promise.all([
			createVerifiedUser('AlphaBuyer'),
			createVerifiedUser('BetaBuyer')
		]);
		await Promise.all([
			claimTicketViaApi(alpha, event.id, tier.id),
			claimTicketViaApi(beta, event.id, tier.id)
		]);
		const alphaName = `${alpha.firstName} ${alpha.lastName}`;

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();

		// Both PENDING tickets are listed.
		await expect(page.getByText(alphaName).filter({ visible: true }).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(
			page.getByText(`${beta.firstName} ${beta.lastName}`).filter({ visible: true }).first()
		).toBeVisible();

		// Search narrows the list to one attendee (server-side, URL-driven).
		const search = page.getByPlaceholder('Search by name, email, or tier...');
		await search.fill(alpha.email);
		await expect(
			page.getByText(`${beta.firstName} ${beta.lastName}`).filter({ visible: true })
		).toHaveCount(0, { timeout: 15_000 });
		await expect(page.getByText(alphaName).filter({ visible: true }).first()).toBeVisible();
		await search.fill('');
		await expect(
			page.getByText(`${beta.firstName} ${beta.lastName}`).filter({ visible: true }).first()
		).toBeVisible({ timeout: 15_000 });

		// Sortable column headers are a desktop-table affordance.
		if (!isMobile) {
			await page.getByRole('button', { name: 'Purchased' }).click();
			await expect(page).toHaveURL(/order_by=/, { timeout: 15_000 });
		}

		// Confirm alpha's offline payment → ACTIVE.
		const activeAlphaRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: alphaName })
			.filter({ hasText: /Active/ })
			.filter({ visible: true })
			.first();
		await page
			.getByRole('button', { name: 'Confirm Payment' })
			.filter({ visible: true })
			.first()
			.click();
		const confirmDialog = page.getByRole('dialog', { name: 'Confirm Payment' });
		await confirmDialog.getByRole('button', { name: 'Confirm Payment' }).click();
		await expect(activeAlphaRow).toBeVisible({ timeout: 20_000 });

		// Revert it back to pending via the row's actions menu.
		const alphaKebab = page
			.getByRole('button', { name: `More actions for ${alphaName}` })
			.filter({ visible: true });
		const pendingAlphaRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: alphaName })
			.filter({ hasText: /Pending/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			if (!(await pendingAlphaRow.isVisible())) {
				await alphaKebab.first().click({ timeout: 3_000 });
				await page.getByRole('menuitem', { name: 'Revert to Pending' }).click({ timeout: 3_000 });
				const revertDialog = page.getByRole('dialog', { name: 'Revert Payment Status' });
				await revertDialog.getByRole('button', { name: 'Revert to Pending' }).click({
					timeout: 3_000
				});
			}
			await expect(pendingAlphaRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// Admin-cancel beta's ticket.
		const betaName = `${beta.firstName} ${beta.lastName}`;
		const betaKebab = page
			.getByRole('button', { name: `More actions for ${betaName}` })
			.filter({ visible: true });
		const cancelledBetaRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: betaName })
			.filter({ hasText: /Cancelled/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			if (!(await cancelledBetaRow.isVisible())) {
				await betaKebab.first().click({ timeout: 3_000 });
				await page.getByRole('menuitem', { name: 'Cancel Ticket' }).click({ timeout: 3_000 });
				const cancelDialog = page.getByRole('dialog', { name: 'Cancel Ticket' });
				await cancelDialog.getByRole('button', { name: 'Cancel Ticket' }).click({
					timeout: 3_000
				});
			}
			await expect(cancelledBetaRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });
	});
});
