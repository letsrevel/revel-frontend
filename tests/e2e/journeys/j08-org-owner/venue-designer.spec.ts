import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — sector-block DESIGNER smoke: the venue's /designer
// route renders each SECTOR as a block (plus the stage) on one SVG canvas. A
// block can be selected and keyboard-ROTATED (the a11y path — [ and ] rotate by
// 15°, more deterministic than drag in e2e), which makes the layout dirty, and
// Save persists the arrangement (sector.metadata.transform / venue.metadata).
// The unsaved-changes guard fires a confirm() when navigating away dirty.
//
// Transform/save round-trip is unit-tested (designer-save / designer-interactions);
// this smoke proves the route + render + rotate + save wiring end to end.
//
// Isolation: throwaway org + venue + a seated sector arranged via API, so the
// designer has a real block; nothing seeded is touched.

interface DesignerFixture {
	page: Page;
	slug: string;
	venueId: string;
	close: () => Promise<void>;
}

/** Arrange a throwaway venue with one seated sector (4 seats) and open its designer. */
async function openDesigner(browser: Browser): Promise<DesignerFixture> {
	const org = await createOrganization();
	const api = await ApiClient.login(org.owner.email, org.owner.password);
	const venue = await api.post<{ id: string }>(`/api/organization-admin/${org.slug}/venues`, {
		name: uniqueName('Venue')
	});
	await api.post(`/api/organization-admin/${org.slug}/venues/${venue.id}/sectors`, {
		name: 'Stalls',
		code: 'STL',
		seats: [
			{ label: 'A1', row: 'A', number: 1, position: { x: 0, y: 0 } },
			{ label: 'A2', row: 'A', number: 2, position: { x: 1, y: 0 } },
			{ label: 'B1', row: 'B', number: 1, position: { x: 0, y: 1 } },
			{ label: 'B2', row: 'B', number: 2, position: { x: 1, y: 1 } }
		]
	});

	const context = await browser.newContext();
	await authenticateContext(context, org.owner);
	const page = await context.newPage();
	await gotoHydrated(page, `/org/${org.slug}/admin/venues/${venue.id}/designer`);
	await waitForClientAuth(page);

	return { page, slug: org.slug, venueId: venue.id, close: () => context.close() };
}

test.describe('J8 venue designer @p2', () => {
	test('canvas renders sector blocks → select → keyboard rotate → save', async ({ browser }) => {
		test.setTimeout(150_000);

		const { page, close } = await openDesigner(browser);

		// The canvas renders and carries the arranged sector as a block.
		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible({
			timeout: 15_000
		});
		const block = page.getByRole('button', { name: /^Sector Stalls, rotated 0°/ });
		await expect(block).toBeVisible();

		// Save starts disabled (no pending edits yet).
		const saveButton = page.getByRole('button', { name: 'Save layout' });
		await expect(saveButton).toBeDisabled();

		// Select the block (click), then keyboard-rotate it — the a11y path: a
		// focused, selected block rotates 15° with "]", which makes the layout
		// dirty (Save enables) and updates the block's accessible name.
		await block.click();
		await expect(block).toHaveAttribute('aria-pressed', 'true');
		await block.focus();
		await page.keyboard.press(']');
		await expect(page.getByRole('button', { name: /^Sector Stalls, rotated 15°/ })).toBeVisible();
		await expect(saveButton).toBeEnabled();

		// Save persists the plan; the toast confirms the round-trip succeeded.
		await saveButton.click();
		await expect(page.getByText('Layout saved')).toBeVisible({ timeout: 15_000 });
		// After a successful save the layout is clean again.
		await expect(saveButton).toBeDisabled({ timeout: 15_000 });

		await close();
	});

	test('unsaved-changes guard fires confirm() when navigating away dirty', async ({ browser }) => {
		test.setTimeout(150_000);

		const { page, close } = await openDesigner(browser);

		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible({
			timeout: 15_000
		});
		const block = page.getByRole('button', { name: /^Sector Stalls/ });
		await expect(block).toBeVisible();

		// Make the layout dirty without saving.
		await block.click();
		await block.focus();
		await page.keyboard.press(']');
		await expect(page.getByRole('button', { name: 'Save layout' })).toBeEnabled();

		// Navigating away now must prompt: beforeNavigate calls confirm(). Dismiss
		// it (stay), and prove it fired and the navigation was cancelled.
		let confirmSeen = false;
		page.on('dialog', async (dialog) => {
			confirmSeen = true;
			expect(dialog.type()).toBe('confirm');
			await dialog.dismiss();
		});

		await page.getByRole('button', { name: 'Back to venue' }).click();

		await expect.poll(() => confirmSeen, { timeout: 10_000 }).toBe(true);
		// Cancelled navigation keeps us on the designer (canvas still present).
		await expect(page).toHaveURL(/\/designer$/);
		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible();

		await close();
	});
});
