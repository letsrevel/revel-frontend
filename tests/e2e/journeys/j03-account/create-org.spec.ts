import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';

// J3.6 (USER_JOURNEYS.md) — create an organization through the form: a name
// slugifying to a reserved token is rejected with the backend's message, a
// valid name lands the new owner on the org admin settings page, and a
// revisit shows the one-org-per-owner guard.
//
// Isolation: throwaway verified user — every seeded owner persona already
// owns an org and could never pass the one-org rule.

test.describe('J3 create organization @p1', () => {
	test('reserved-word name rejected; valid name creates org; one-org guard', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const user = await createVerifiedUser('OrgCreator');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/create-org');
		await expect(page.getByRole('heading', { name: 'Create Your Organization' })).toBeVisible();

		// The primary button opens a custom confirmation overlay (no dialog
		// role); it closes itself before submitting, so each attempt sees
		// exactly one 'Create Organization' button at a time.
		async function submitName(name: string): Promise<void> {
			await page.locator('#name').fill(name);
			await page.locator('#contact_email').fill(user.email);
			await page.getByRole('button', { name: 'Create Organization' }).click();
			await expect(page.getByText('Confirm Organization Creation')).toBeVisible();
			await page
				.locator('div.fixed.inset-0')
				.getByRole('button', { name: 'Create Organization' })
				.click();
		}

		// "dashboard" is a reserved slug token — backend 400 surfaces verbatim.
		await submitName('Dashboard Collective');
		await expect(page.getByText('Failed to create organization')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText(/reserved word: "dashboard"/)).toBeVisible();

		// A valid name creates the org and redirects to its admin settings.
		const orgName = uniqueName('Org');
		await submitName(orgName);
		await page.waitForURL(/\/org\/[^/]+\/admin\/settings/, { timeout: 30_000 });
		await expect(page.getByText(orgName).first()).toBeVisible();

		// One org per owner: the form is replaced by the already-owner guard.
		await gotoHydrated(page, '/create-org');
		await expect(page.getByText('You already own an organization')).toBeVisible();

		await context.close();
	});
});
