import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J14 (USER_JOURNEYS.md) — potluck coordination on the seeded Spring
// Community Potluck: the seeded items render with type labels and claim
// states, an RSVP'd attendee adds their own item (auto-claimed), unclaims it
// and claims it back; a non-attendee sees the RSVP gate.
//
// Isolation: claim/unclaim runs on the spec's OWN uniquely-named item — the
// 12 seeded items are only read, so the seed stays pristine for j05 and for
// repeated runs. Personas: charlie (desktop) / karen (mobile), both seeded
// RSVP-yes and stable — j05 owns hannah/ivan's RSVPs here and leaves them at
// "No", which would strip their claim permission mid-run.

const EVENT_PATH = '/events/revel-events-collective/spring-community-potluck';

/** The potluck list is a collapsible disclosure — expand it if collapsed. */
async function openPotluckSection(page: Page): Promise<void> {
	const section = page.getByRole('region', { name: /Potluck Coordination/ });
	await expect(section).toBeVisible();
	if ((await section.getByRole('button', { name: /^Claim |^Unclaim |bring/ }).count()) === 0) {
		await section.getByRole('button', { name: /Potluck Coordination/ }).click();
	}
}

function itemCard(page: Page, name: string) {
	return page.locator('article').filter({ hasText: name }).first();
}

test.describe('J14 potluck @p1', () => {
	test('seeded items render; add own item, unclaim, reclaim', async ({ browser, isMobile }) => {
		test.setTimeout(120_000);
		// Different persona per project — parallel runs never share claim state.
		const persona = isMobile ? 'multiOrg' : 'member';
		const ownSeededItem = isMobile ? 'Fresh Fruit Salad' : 'Fresh Lemonade';
		const context = await browser.newContext();
		await authenticateContext(context, persona);
		const page = await context.newPage();

		await gotoHydrated(page, EVENT_PATH);
		await waitForClientAuth(page);
		await openPotluckSection(page);

		// Seeded items render with type metadata and per-user claim states:
		// someone else's claim is locked…
		const lasagna = itemCard(page, 'Homemade Lasagna');
		await expect(lasagna.getByText('Main Course')).toBeVisible();
		await expect(lasagna.getByText('(Already claimed)')).toBeVisible();
		await expect(lasagna.getByRole('button', { name: 'Claim Homemade Lasagna' })).toBeDisabled();
		// …the persona's own seeded claim shows as theirs (read-only — never
		// unclaim a seeded item).
		await expect(itemCard(page, ownSeededItem).getByText("You're bringing")).toBeVisible();
		// Host suggestions exist and are claimable.
		await expect(
			itemCard(page, 'Main Course (pasta, casserole, etc)').getByText('Unclaimed')
		).toBeVisible();

		// Add an own item — for a regular RSVP'd attendee the modal submits as
		// "Add & claim". The section re-renders as queries settle (clicks/fills
		// can be dropped), so run add-and-claim as an outcome-keyed loop.
		const itemName = uniqueName('Dish');
		const unclaimButton = page.getByRole('button', { name: `Unclaim ${itemName}` }).first();
		await expect(async () => {
			if (await unclaimButton.isVisible()) return;
			// The modal title mirrors the trigger: organizers get "Add potluck
			// item", regular attendees "Add item you'll bring".
			const modal = page.getByRole('dialog', { name: /Add item you'll bring|Add potluck item/ });
			if (!(await modal.isVisible())) {
				await page
					.getByRole('button', { name: /Add item you'll bring|Add potluck item/ })
					.click({ timeout: 3_000 });
			}
			await modal.locator('#edit-item-name').fill(itemName);
			await modal.locator('#edit-item-type').selectOption({ label: 'Dessert' });
			await modal.getByRole('button', { name: 'Add & claim' }).click();
			await expect(unclaimButton).toBeVisible({ timeout: 4_000 });
		}).toPass({ timeout: 60_000 });
		await expect(itemCard(page, itemName).getByText("You're bringing")).toBeVisible();
		await expect(itemCard(page, itemName).getByText('Dessert', { exact: true })).toBeVisible();

		// Unclaim it — back to a claimable suggestion…
		await unclaimButton.click();
		const claimButton = page.getByRole('button', { name: `Claim ${itemName}` }).first();
		await expect(claimButton).toBeVisible({ timeout: 10_000 });
		await expect(itemCard(page, itemName).getByText('Unclaimed')).toBeVisible();

		// …and claim it back.
		await claimButton.click();
		await expect(unclaimButton).toBeVisible({ timeout: 10_000 });
		await expect(itemCard(page, itemName).getByText("You're bringing")).toBeVisible();

		await context.close();
	});

	test('non-attendee sees the RSVP gate instead of claim buttons', async ({ asBetaOwner }) => {
		await gotoHydrated(asBetaOwner, EVENT_PATH);
		await openPotluckSection(asBetaOwner);
		const gated = asBetaOwner.getByRole('button', { name: /^Claim / }).filter({
			hasText: 'RSVP "Yes" to claim'
		});
		await expect(gated.first()).toBeVisible();
		await expect(gated.first()).toBeDisabled();
	});
});
