import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, getSeededBestAvailableEvent } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #679 — map-first tier selection: the public event page grows a "View
// seating map" entry point that opens a whole-venue overview where every
// sector shows which tier(s) sell it at what price. A 1:1 sector (Galleria)
// routes STRAIGHT into that tier's purchase dialog; a 1:N sector (Platea —
// sold by a flat user_choice tier AND a category-priced best-available tier)
// opens a small chooser first. Sectors sold by no purchasable tier (Palco
// 2–4) render as inert not-for-sale ghosts.
//
// Isolation: runs read-only against the SHARED seeded "La Traviata — Season
// Opening" showcase event (see best-available.spec.ts) — dialogs are opened
// and closed but nothing is ever reserved, so parallel specs are unaffected.
// The seeded venue has NO stage metadata, so the overview shows the fallback
// top-center STAGE pill (expected, not a bug).

test.describe('J6 map-first venue overview @p2', () => {
	test('seating map entry → sector overview → 1:1 direct route → 1:N chooser', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('MapFirst')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			// Sector targets carry the selling tier(s) + price(s) in their names.
			const galleriaSector = overview.getByRole('button', {
				name: 'Galleria: Galleria, EUR 25.00'
			});
			const plateaSector = overview.getByRole('button', {
				name: 'Platea: Platea, EUR 45.00; Platea — Best Available, EUR 45.00 - EUR 80.00'
			});

			// Open the overview from the Ticket Options entry point.
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Every sector renders: sold sectors as focusable buttons, the
			// unsold Palchi as inert ghosts, plus the fallback STAGE pill.
			await expect(galleriaSector).toBeVisible({ timeout: 15_000 });
			await expect(plateaSector).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 1:/ })).toBeVisible();
			await expect(
				overview.getByRole('img', { name: 'Palco 2: no tickets on sale' })
			).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 2/ })).toBeHidden();
			await expect(overview.getByText('STAGE')).toBeVisible();

			// Galleria is sold by ONE tier → routes straight into its purchase
			// dialog (best-available panel; the single Galleria zone
			// auto-selects once availability loads).
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			const bestPanel = confirmDialog.getByText('Best available seats');
			await expect(async () => {
				if (await bestPanel.isVisible()) return;
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await galleriaSector.click();
				await expect(bestPanel).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(confirmDialog.getByRole('radio', { name: /Galleria/ })).toBeChecked({
				timeout: 8_000
			});

			// Back out. Escape only closes the TOPMOST dialog: the confirmation
			// first, then the pre-selected "Select Your Ticket" modal that sits
			// beneath it (same stacking as the inline TierCard pre-selection).
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) await page.keyboard.press('Escape');
				await expect(confirmDialog).toBeHidden();
				if (await tierDialog.isVisible()) await page.keyboard.press('Escape');
				await expect(tierDialog).toBeHidden();
			}).toPass({ timeout: 30_000 });

			// Platea is sold by TWO tiers → the chooser lists BOTH with their
			// honest prices and a seat-assignment mode hint.
			const chooser = page.getByRole('dialog', { name: 'Choose a ticket for Platea' });
			await expect(async () => {
				if (await chooser.isVisible()) return;
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await plateaSector.click();
				await expect(chooser).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			const flatOption = chooser.getByRole('button', { name: /^Platea EUR 45\.00/ });
			const bestOption = chooser.getByRole('button', {
				name: /^Platea — Best Available EUR 45\.00 - EUR 80\.00/
			});
			await expect(flatOption).toBeVisible();
			await expect(flatOption).toContainText('Choose your own seats');
			await expect(bestOption).toBeVisible();
			await expect(bestOption).toContainText('Best available seats assigned');

			// Picking the best-available tier lands in ITS dialog: the mandatory
			// two-zone picker renders both zones and their prices (nothing
			// auto-selects with two zones).
			const zonePicker = confirmDialog.getByText('Seating zone', { exact: true });
			await expect(async () => {
				if (await zonePicker.isVisible()) return;
				if (await bestOption.isVisible()) {
					await bestOption.click();
				}
				await expect(zonePicker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(confirmDialog.getByRole('radio', { name: /Platea Premium/ })).toBeVisible();
			await expect(confirmDialog.getByText('€80.00')).toBeVisible();
			await expect(confirmDialog.getByText('€45.00')).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
