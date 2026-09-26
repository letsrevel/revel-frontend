import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { addToBlacklist, createOrganization, uniqueEmail } from '../../support/factories';
import { fillRegistrationForm } from '../../support/auth-forms';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J13.4 (USER_JOURNEYS.md) — auto-linking. A blacklist entry can be added for
// an email that has no account yet; when someone later REGISTERS that email,
// the backend's RevelUser post_save signal links the entry to the new user's
// FK (upgrading it to a hard, account-bound block) and applies the ban
// consequences. On the org's blacklist page this is the entry card gaining
// the "Registered User" badge.
//
// Arrange via API (org + email-only entry); the journey under test — the
// registration — goes through the real /register form; assert on the admin
// blacklist page before and after.
//
// Isolation: throwaway org whose ONLY blacklist entry is this one, and a
// uniqueEmail() nobody else registers.

const PASSWORD = 'E2e-test-Pass!123';

/** The blacklist entry card: the deepest container holding its Manage button. */
function entryCard(page: Page, email: string): Locator {
	return page
		.locator('div')
		.filter({ hasText: email })
		.filter({ has: page.getByRole('button', { name: /^Manage blacklist entry for / }) })
		.last();
}

test.describe('J13 blacklist auto-links on registration @p2', () => {
	test('an email-only entry links to the account registered with that email', async ({
		browser,
		page
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization();
		const email = uniqueEmail('BlacklistedLater');
		await addToBlacklist(org.owner, org.slug, {
			email,
			reason: 'E2E auto-link journey'
		});

		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		try {
			// Before: an unlinked entry, identified only by the email.
			await gotoHydrated(ownerPage, `/org/${org.slug}/admin/blacklist`);
			await waitForClientAuth(ownerPage);
			const card = entryCard(ownerPage, email);
			await expect(card).toBeVisible({ timeout: 15_000 });
			await expect(card.getByText('E2E auto-link journey')).toBeVisible();
			await expect(card.getByText('Registered User')).toHaveCount(0);

			// The blacklisted address signs up through the real registration form.
			await fillRegistrationForm(page, email, PASSWORD);
			await page.getByRole('button', { name: 'Create your account' }).click();
			await page.waitForURL(/\/register\/check-email/);

			// After: the same entry is now bound to the new account. Linking runs
			// on account creation, so no email verification is needed first.
			await expect(async () => {
				await gotoHydrated(ownerPage, `/org/${org.slug}/admin/blacklist`);
				await expect(entryCard(ownerPage, email).getByText('Registered User')).toBeVisible({
					timeout: 5_000
				});
			}).toPass({ timeout: 30_000 });
			// Still exactly one entry — linked in place, not duplicated.
			await expect(
				ownerPage.getByRole('button', { name: /^Manage blacklist entry for / })
			).toHaveCount(1);
		} finally {
			await ownerContext.close();
		}
	});
});
