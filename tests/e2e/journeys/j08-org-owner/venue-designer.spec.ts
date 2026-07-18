import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — freeform seat-map DESIGNER smoke (#659): the venue's
// /designer route renders every sector's seats on one SVG canvas, a seat can be
// selected and keyboard-nudged (the a11y path — more deterministic than drag in
// e2e), and Save persists the layout. The unsaved-changes guard fires a
// confirm() when navigating away with pending edits.
//
// Position round-trip is unit-tested (designer-save / designer-geometry); this
// smoke proves the route + render + save wiring end to end. Persistence across
// a reload is NOT asserted here (that is the unit tests' job).
//
// Isolation: throwaway org + venue + a seated sector arranged via API, so the
// designer has a real grid to draw; nothing seeded is touched.

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
	test('canvas renders seats → select → keyboard nudge → save', async ({ browser }) => {
		test.setTimeout(150_000);

		const { page, close } = await openDesigner(browser);

		// The canvas renders and carries the arranged seats.
		await expect(page.getByRole('application', { name: 'Seat layout canvas' })).toBeVisible({
			timeout: 15_000
		});
		const seatA1 = page.getByRole('button', { name: 'Seat A1, Stalls', exact: true });
		await expect(seatA1).toBeVisible();

		// Save starts disabled (no pending edits yet).
		const saveButton = page.getByRole('button', { name: 'Save layout' });
		await expect(saveButton).toBeDisabled();

		// Select the seat (click), then keyboard-nudge it — the a11y path: a
		// focused, selected seat moves with an arrow key, which makes the layout
		// dirty (Save enables).
		await seatA1.click();
		await expect(seatA1).toHaveAttribute('aria-pressed', 'true');
		await seatA1.focus();
		await page.keyboard.press('ArrowRight');
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
		const seatA1 = page.getByRole('button', { name: 'Seat A1, Stalls', exact: true });
		await expect(seatA1).toBeVisible();

		// Make the layout dirty without saving.
		await seatA1.click();
		await seatA1.focus();
		await page.keyboard.press('ArrowRight');
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
