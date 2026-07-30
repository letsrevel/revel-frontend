import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createTicketedEvent } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 visibility settings — the two fields phase 2 (#713/#718) moved OUT of
// the event's top level and INTO `visibility_settings`
// (`address_visibility`, and `public_pronoun_distribution` renamed to
// `show_pronoun_distribution`). The backend merges `visibility_settings` at
// sub-key granularity, but every Save round-trips all FIVE resolved keys
// (see `visibilitySettingsForWrite` in `event-payload.ts`) — so the frontend
// MUST keep the untouched keys in `formData.visibility_settings` alive
// across edits, or a save that only touches an unrelated key silently
// resets address_visibility/show_pronoun_distribution back to their
// defaults. That mutual non-clobbering is what this spec protects.

async function ensureExpanded(toggle: Locator): Promise<void> {
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
		await toggle.click();
	}
}

async function saveAndWait(page: Page): Promise<void> {
	// Two SaveBars render (top + bottom of the editor) — take the first.
	await page.getByRole('button', { name: 'Save', exact: true }).first().click();
	await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });
}

test.describe('J10 visibility settings @p2', () => {
	test('address visibility + pronoun opt-in survive an unrelated toggle, and vice versa', async ({
		asOwner
	}) => {
		test.setTimeout(120_000);

		// Org Alpha has a default city (Vienna), so `city_id` is prefilled from
		// `orgCity` and the Details tab validates without any city UI.
		const event = await createTicketedEvent();
		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Edit Event', level: 1 })).toBeVisible();

		// --- Round 1: switch to address mode, set a non-public address
		// visibility, and opt into pronoun distribution. ---
		await page.getByRole('button', { name: 'Add Address' }).click();
		// A non-empty address is required for `derivedMode` to resolve back to
		// "address" on the next load — otherwise the LocationSection would
		// revert to the CTA screen and hide the visibility select entirely.
		await page.locator('#location-address').fill('123 Test Street');
		await page.locator('#location-address-visibility').selectOption('members-only');

		await page.getByRole('button', { name: 'Advanced' }).click();
		await page.getByLabel('Public pronoun distribution').check();

		await saveAndWait(page);

		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.locator('#location-address-visibility')).toHaveValue('members-only');
		await page.getByRole('button', { name: 'Advanced' }).click();
		await expect(page.getByLabel('Public pronoun distribution')).toBeChecked();

		// --- Round 2: flip an UNRELATED phase-1 toggle (uncheck "Show
		// capacity"). The address visibility and pronoun opt-in from round 1
		// must survive this save untouched. ---
		await ensureExpanded(page.getByTestId('visibility-section-toggle'));
		await page.getByTestId('visibility-show-capacity').uncheck();

		await saveAndWait(page);

		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.locator('#location-address-visibility')).toHaveValue('members-only');
		await page.getByRole('button', { name: 'Advanced' }).click();
		await expect(page.getByLabel('Public pronoun distribution')).toBeChecked();
		await ensureExpanded(page.getByTestId('visibility-section-toggle'));
		await expect(page.getByTestId('visibility-show-capacity')).not.toBeChecked();

		// --- Round 3: the converse — changing address visibility again must
		// NOT reset the phase-1 toggle from round 2. ---
		await page.locator('#location-address-visibility').selectOption('attendees-only');

		await saveAndWait(page);

		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.locator('#location-address-visibility')).toHaveValue('attendees-only');
		await ensureExpanded(page.getByTestId('visibility-section-toggle'));
		await expect(page.getByTestId('visibility-show-capacity')).not.toBeChecked();
		await page.getByRole('button', { name: 'Advanced' }).click();
		await expect(page.getByLabel('Public pronoun distribution')).toBeChecked();
	});
});
