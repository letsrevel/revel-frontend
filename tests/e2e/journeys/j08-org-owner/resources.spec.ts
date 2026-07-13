import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — org resources: the owner creates a public link
// resource and a members-only text resource through the admin UI (both
// displayed on the org page), then the public resources page filters them
// per viewer: a member sees both, an anonymous visitor only the public one.
//
// Isolation: throwaway-owned org + throwaway member.

test.describe('J8 org resources @p2', () => {
	test('create link/text resources; visibility filters per persona', async ({ browser }) => {
		test.setTimeout(150_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('ResourceReader');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		const publicName = uniqueName('Public Link');
		const membersName = uniqueName('Members Text');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/resources`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Resources', level: 1 })).toBeVisible();

		const modal = page.getByRole('dialog', { name: /Add Resource/ });

		// Public link resource, shown on the org page. (Header button +
		// empty-state CTA both say "Add Resource" on a fresh org — .first().)
		await page.getByRole('button', { name: 'Add Resource' }).first().click();
		await expect(modal).toBeVisible();
		await modal.getByRole('button', { name: 'Link', exact: true }).click();
		await modal.getByLabel(/^Name/).fill(publicName);
		await modal.getByLabel('URL').fill('https://example.com/e2e');
		await modal.getByLabel('Visibility').selectOption({ label: 'Public - Anyone can view' });
		await modal.getByLabel('Display on organization page').check();
		await modal.getByRole('button', { name: 'Create Resource' }).click();
		await expect(modal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(publicName)).toBeVisible();

		// Members-only text resource, also shown on the org page.
		await page.getByRole('button', { name: 'Add Resource' }).click();
		await expect(modal).toBeVisible();
		await modal.getByRole('button', { name: 'Text', exact: true }).click();
		await modal.getByLabel(/^Name/).fill(membersName);
		await modal.getByLabel('Content').fill('Members-only content for the E2E journey.');
		await modal
			.getByLabel('Visibility')
			.selectOption({ label: 'Members Only - Requires membership' });
		await modal.getByLabel('Display on organization page').check();
		await modal.getByRole('button', { name: 'Create Resource' }).click();
		await expect(modal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(membersName)).toBeVisible();

		// A member sees both on the public resources page.
		const memberContext = await browser.newContext();
		await authenticateContext(memberContext, member);
		const memberPage = await memberContext.newPage();
		await memberPage.goto(`/org/${org.slug}/resources`);
		await expect(memberPage.getByText(publicName)).toBeVisible();
		await expect(memberPage.getByText(membersName)).toBeVisible();
		await memberContext.close();

		// An anonymous visitor only sees the public one.
		const anonContext = await browser.newContext();
		const anonPage = await anonContext.newPage();
		await anonPage.goto(`/org/${org.slug}/resources`);
		await expect(anonPage.getByText(publicName)).toBeVisible();
		await expect(anonPage.getByText(membersName)).toBeHidden();
		await anonContext.close();

		await context.close();
	});
});
