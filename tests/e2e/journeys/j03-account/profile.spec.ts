import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { createVerifiedUser, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';

// J3.3 (USER_JOURNEYS.md) — profile editing: names/pronouns/bio round-trip
// through the /account/profile form, and the preferred-language choice
// persists across reloads.
//
// Isolation: BOTH tests register throwaway users. Editing a seeded persona
// in place — even with a restore step — races other specs that assert on
// seeded display names (j08 org-tokens hardcodes "Ivan Attendee"), and a
// crashed run would leave the seed altered; personas.ts forbids mutating
// shared persona accounts. A seeded persona left in German would likewise
// break every other spec's English-label selectors.

test.describe('J3 profile @p1', () => {
	test('edits names, pronouns and bio; values persist across reload', async ({ browser }) => {
		test.setTimeout(120_000);
		const user = await createVerifiedUser('ProfileEditor');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/profile');
		await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();

		const newFirst = uniqueName('First');
		const newPreferred = uniqueName('Preferred');
		const newPronouns = 'ze/zir';
		const newBio = uniqueName('Bio text');

		await page.locator('#first_name').fill(newFirst);
		await page.locator('#preferred_name').fill(newPreferred);
		// Pronouns render as a common-options select unless the current value
		// is already custom, in which case the free-text input shows directly.
		const pronounsSelect = page.locator('#pronouns-select');
		if (await pronounsSelect.isVisible()) {
			await pronounsSelect.selectOption('custom');
		}
		await page.locator('#pronouns').fill(newPronouns);
		// Bio is a Tiptap editor bound to a hidden input.
		await page.locator('[contenteditable="true"]').first().fill(newBio);

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Profile updated successfully')).toBeVisible({
			timeout: 15_000
		});

		// The save is server-side: a fresh load renders the new values.
		await gotoHydrated(page, '/account/profile');
		await expect(page.locator('#first_name')).toHaveValue(newFirst);
		await expect(page.locator('#preferred_name')).toHaveValue(newPreferred);
		await expect(page.locator('#pronouns')).toHaveValue(newPronouns);
		await expect(page.locator('[contenteditable="true"]').first()).toContainText(newBio);

		await context.close();
	});

	test('preferred language persists across reloads', async ({ browser }) => {
		test.setTimeout(120_000);
		const user = await createVerifiedUser('Polyglot');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/profile');
		await page.locator('#language').selectOption('de');
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// A successful save calls setLocale('de'), which reloads into German.
		await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible({
			timeout: 20_000
		});

		// Persisted, not just client state: a hard reload stays German and the
		// backend profile carries the language.
		await gotoHydrated(page, '/account/profile');
		await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
		await expect(page.locator('#language')).toHaveValue('de');
		const api = await ApiClient.login(user.email, user.password);
		const me = await api.get<{ language: string }>('/api/account/me');
		expect(me.language).toBe('de');

		await context.close();
	});
});
