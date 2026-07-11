import { test, expect } from '../../support/fixtures';
import { createOrganization, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.5 (USER_JOURNEYS.md) — follow an organization (with notification
// preferences), request membership with a message, and see the request land
// in the org admin's queue; unfollow at the end.
//
// Isolation: throwaway-owned org (accepting requests) + throwaway follower —
// seeded follow relationships (hannah→Alpha, ivan→Beta) stay untouched, and
// parallel projects each build their own org/user pair.

test.describe('J3 follow org & request membership @p1', () => {
	test('follow with notify prefs, request membership → admin queue, unfollow', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, follower] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Follower')
		]);
		const followerName = `${follower.firstName} ${follower.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, follower);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		// Follow ('Following' also matches 'Follow' as a prefix — exact match).
		await page.getByRole('button', { name: 'Follow', exact: true }).click();
		await expect(page.getByText(`You are now following ${org.name}`)).toBeVisible({
			timeout: 15_000
		});

		// The control becomes a dropdown holding per-channel notify toggles.
		await page.getByRole('button', { name: 'Following' }).click();
		await page.getByRole('menuitemcheckbox', { name: 'Notify me about new events' }).click();
		await expect(page.getByText('Preferences updated')).toBeVisible({ timeout: 15_000 });

		// Request membership with a message.
		await page.getByRole('button', { name: 'Request Membership' }).click();
		const dialog = page.getByRole('dialog', { name: 'Request Membership' });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Message (Optional)').fill('E2E: please let me in');
		await dialog.getByRole('button', { name: 'Submit Request' }).click();
		await expect(page.getByText('Request Submitted!')).toBeVisible({ timeout: 15_000 });

		// Both are server-side: a fresh load still shows Following…
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();

		// …and the org admin's request queue lists the applicant + message.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(ownerPage);
		// Real tabs here (unlike the event invitations page's URL-param buttons).
		await ownerPage.getByRole('tab', { name: 'Requests' }).click();
		await expect(
			ownerPage.getByRole('button', { name: `Approve request from ${followerName}` })
		).toBeVisible({ timeout: 15_000 });
		// The applicant's message is shown in the request-details view.
		await ownerPage
			.getByRole('button', { name: `View request details from ${followerName}` })
			.click();
		await expect(
			ownerPage.getByText('E2E: please let me in').filter({ visible: true }).first()
		).toBeVisible();
		await ownerContext.close();

		// Unfollow via the dropdown; the plain Follow button returns.
		await page.getByRole('button', { name: 'Following' }).click();
		await page.getByRole('menuitem', { name: 'Unfollow' }).click();
		await expect(page.getByText(`You have unfollowed ${org.name}`)).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();

		await context.close();
	});
});
