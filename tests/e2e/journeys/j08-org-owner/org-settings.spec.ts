import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueEmail } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8.1 (USER_JOURNEYS.md) — org settings: edit profile fields, visibility,
// membership toggle; save persists (SvelteKit form action). Also the
// contact_method rule: "Email link"/"Contact form" stay disabled until the
// org's contact email is verified (a fresh org's never is).
//
// Isolation: the backend allows ONE org per owner, so the org is created via
// API under a throwaway verified user who then drives the UI as owner.

test.describe('J8 org settings @p1', () => {
	test('owner edits settings, saves, and unverified email gates contact methods', async ({
		browser
	}) => {
		// A contact email that differs from the owner's stays UNVERIFIED, which
		// is what gates the contact-method options below.
		const org = await createOrganization({ contactEmail: uniqueEmail('OrgContact') });
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);

		await expect(page.getByRole('heading', { name: 'Organization Settings' })).toBeVisible();

		// contact_method rule: link/form options are disabled while the contact
		// email is unverified, with the explanatory hint shown.
		const contactMethod = page.locator('#contact_method');
		await expect(contactMethod.locator('option', { hasText: 'Email link' })).toBeDisabled();
		await expect(contactMethod.locator('option', { hasText: 'Contact form' })).toBeDisabled();
		await expect(page.getByText('Verify your contact email above')).toBeVisible();

		// Edit address, visibility, and the membership-requests toggle.
		await page.getByLabel('Address').fill('42 E2E Test Street');
		await page
			.locator('#visibility')
			.selectOption({ label: 'Members Only - Only organization members can view' });
		await page.getByLabel('Accept membership requests').check();

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(
			page.getByText('Your organization settings have been updated successfully.')
		).toBeVisible({ timeout: 15_000 });

		// The saved values survive a fresh load.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await expect(page.getByLabel('Address')).toHaveValue('42 E2E Test Street');
		await expect(page.locator('#visibility option:checked')).toHaveText(/Members Only/);
		await expect(page.getByLabel('Accept membership requests')).toBeChecked();

		await context.close();
	});
});
