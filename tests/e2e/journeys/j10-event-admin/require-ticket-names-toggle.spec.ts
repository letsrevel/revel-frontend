import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createTicketedEvent } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 (#753) — the organizer toggle for `require_ticket_names`. The flag
// defaults to ON and the event editor exposes it in the Advanced section for
// ticketed events only. The round-trip (off → save → reload → still off) is
// what proves the editor both SENDS the flag on save and re-hydrates it from
// the API afterwards — a write-only or read-only half would still look right
// on screen immediately after the click.
//
// Isolation: an own API-created event, so flipping the flag can never change
// the checkout shape of seeded events other suites buy tickets on.

async function saveAndWait(page: Page): Promise<void> {
	// Two SaveBars render (top + bottom of the editor) — take the first.
	await page.getByRole('button', { name: 'Save', exact: true }).first().click();
	await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });
}

test.describe('J10 require ticket names toggle @p2', () => {
	test('defaults on, toggles off, and survives a reload', async ({ asOwner }) => {
		test.setTimeout(120_000);

		// Org Alpha has a default city (Vienna), so `city_id` is prefilled and
		// the Details tab validates without any city UI (see
		// visibility-settings.spec.ts).
		const event = await createTicketedEvent();
		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Edit Event', level: 1 })).toBeVisible();

		await page.getByRole('button', { name: 'Advanced' }).click();
		const toggle = page.getByLabel('Require ticket holder names');
		await expect(toggle).toBeChecked();

		await toggle.uncheck();
		await saveAndWait(page);

		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Advanced' }).click();
		await expect(page.getByLabel('Require ticket holder names')).not.toBeChecked();
	});
});
