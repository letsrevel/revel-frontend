import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { uniqueName } from '../../support/factories';

// J5.3–5.4 + J14.2/14.5 (USER_JOURNEYS.md) — the core RSVP loop on the seeded
// Spring Community Potluck: RSVP YES → attendee experience (potluck signup)
// → add & claim an item → RSVP NO → the claimed item is auto-released.
//
// Isolation: desktop and mobile projects run concurrently, so each uses a
// DIFFERENT persona (hannah / ivan) and creates its OWN uniquely-named potluck
// item — no contention on seeded rows, and crashed runs can't poison later
// ones. The flow ends on RSVP NO, so it is re-runnable without reseeding.

const EVENT_PATH = '/events/revel-events-collective/spring-community-potluck';

/**
 * The RSVP card shows Yes/Maybe/No when the user has no answer yet, but a
 * status + "Change RSVP" button when one exists (the seed pre-answers some
 * personas). Normalize to the buttons being visible.
 */
async function openRsvpButtons(page: Page): Promise<void> {
	const anyControl = page.getByRole('button', { name: /^RSVP Yes|^Change RSVP$/ }).first();
	await expect(anyControl).toBeVisible();
	if ((await anyControl.textContent())?.includes('Change RSVP')) {
		await anyControl.click();
	}
}

/** The potluck list is a collapsible disclosure — expand it if collapsed. */
async function openPotluckSection(page: Page): Promise<void> {
	const section = page.getByRole('region', { name: /Potluck Coordination/ });
	await expect(section).toBeVisible();
	if ((await section.getByRole('button', { name: /^Claim |^Unclaim |bring/ }).count()) === 0) {
		await section.getByRole('button', { name: /Potluck Coordination/ }).click();
	}
}

/**
 * Changing an RSVP away from YES with claimed items pops a confirmation
 * dialog ("Unclaim Potluck Items?"). Whether it fires depends on the client's
 * claimed-count cache being fresh — confirm it when it shows, but don't
 * require it (the release itself is asserted separately).
 */
async function confirmUnclaimDialogIfShown(page: Page): Promise<void> {
	const confirmButton = page.getByRole('button', { name: 'Yes, change RSVP' });
	const shown = await confirmButton
		.waitFor({ state: 'visible', timeout: 2_000 })
		.then(() => true)
		.catch(() => false);
	if (shown) {
		await confirmButton.click();
	}
}

/**
 * The seeded potluck event accepts RSVP notes (backend #710 bootstrap), so
 * every RSVP click opens the note-confirm dialog (#651) — after the unclaim
 * warning, when both fire. Confirm it when it shows, tolerating the seed
 * flag being off.
 */
async function confirmNoteDialogIfShown(page: Page): Promise<void> {
	const confirmButton = page
		.getByRole('dialog', { name: 'Confirm your RSVP' })
		.getByRole('button', { name: 'Confirm RSVP' });
	const shown = await confirmButton
		.waitFor({ state: 'visible', timeout: 2_000 })
		.then(() => true)
		.catch(() => false);
	if (shown) {
		await confirmButton.click();
	}
}

test.describe('J5 RSVP flow with potluck auto-release @p0', () => {
	test('YES → add & claim potluck item → NO releases it', async ({ browser, isMobile }) => {
		const context = await browser.newContext();
		await authenticateContext(context, isMobile ? 'user2' : 'user');
		const page = await context.newPage();
		await gotoHydrated(page, EVENT_PATH);
		await waitForClientAuth(page);

		// --- RSVP YES ---
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		await confirmNoteDialogIfShown(page);
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();

		// --- Attendee experience: add & claim our own potluck item ---
		await openPotluckSection(page);
		const itemName = uniqueName('Dish');
		// The section re-renders as the potluck query settles, which can remount
		// the form and drop fills/clicks — run the whole add&claim as an
		// idempotent loop that exits once our item is claimed.
		const unclaimButton = page.getByRole('button', { name: `Unclaim ${itemName}` }).first();
		await expect(async () => {
			if (await unclaimButton.isVisible()) return;
			const nameInput = page.getByLabel(/^Item name/);
			if (!(await nameInput.isVisible())) {
				await page.getByRole('button', { name: /Add item you'll bring|Add potluck item/ }).click();
			}
			await nameInput.fill(itemName);
			await expect(nameInput).toHaveValue(itemName, { timeout: 500 });
			await page.getByRole('button', { name: 'Add & claim' }).click();
			await expect(unclaimButton).toBeVisible({ timeout: 4_000 });
		}).toPass({ timeout: 40_000 });

		// --- RSVP NO: claimed items are auto-released ---
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP No/ }).click();
		await confirmUnclaimDialogIfShown(page);
		await confirmNoteDialogIfShown(page);
		// Released + no longer attending → the claim button renders disabled.
		await expect(page.getByRole('button', { name: `Claim ${itemName}` }).first()).toBeDisabled();

		// --- The release is server-side: after re-YES our item is claimable ---
		await gotoHydrated(page, EVENT_PATH);
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		await confirmNoteDialogIfShown(page);
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();
		await openPotluckSection(page);
		await expect(page.getByRole('button', { name: `Claim ${itemName}` }).first()).toBeEnabled();

		// Leave the loop closed: back to NO (no claims held).
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP No/ }).click();
		await confirmUnclaimDialogIfShown(page);
		await confirmNoteDialogIfShown(page);
		await expect(page.getByRole('button', { name: `Claim ${itemName}` }).first()).toBeDisabled();

		await context.close();
	});
});
