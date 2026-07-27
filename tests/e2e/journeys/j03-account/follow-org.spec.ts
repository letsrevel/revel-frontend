import { test, expect } from '../../support/fixtures';
import { createOrganization, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J3.5 (USER_JOURNEYS.md) — follow an organization (with notification
// preferences), apply for membership with a message, and see the application
// land in the org admin's queue; unfollow at the end.
//
// The join flow is the eligibility CTA + ApplyDialog (PR② of the membership
// subscriptions work); the legacy "Request Membership" button is gone. A UI
// apply carries no tier, so the backend leaves the application PENDING for
// staff — hence the "Application received" outcome and the approve leg below.
//
// Isolation: throwaway-owned org (accepting requests) + throwaway follower —
// seeded follow relationships (hannah→Alpha, ivan→Beta) stay untouched, and
// parallel projects each build their own org/user pair.

test.describe('J3 follow org & request membership @p1', () => {
	test('follow with notify prefs, apply for membership → admin approves, unfollow', async ({
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

		// Apply for membership with a message.
		await page.getByRole('button', { name: `Join ${org.name}` }).click();
		const applyDialog = page.getByRole('dialog', { name: `Join ${org.name}` });
		await expect(applyDialog).toBeVisible();
		await applyDialog.getByLabel('Message (optional)').fill('E2E: please let me in');
		await applyDialog.getByRole('button', { name: 'Send application' }).click();

		// The outcome replaces the form in place, so the dialog is RE-TITLED —
		// a tier-less apply stays PENDING, hence "Application received" (an
		// auto-granted membership would title it "You're in!").
		const outcomeDialog = page.getByRole('dialog', { name: 'Application received' });
		await expect(outcomeDialog).toBeVisible({ timeout: 15_000 });
		await expect(outcomeDialog.getByRole('link', { name: 'Track your application' })).toBeVisible();
		await closeDialog(page, outcomeDialog);

		// The CTA follows the refreshed eligibility verdict.
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeDisabled();

		// Both are server-side: a fresh load still shows Following + the pending
		// application…
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeVisible({
			timeout: 15_000
		});

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
		await closeDialog(
			ownerPage,
			ownerPage.getByRole('dialog', { name: `Membership Request from ${followerName}` })
		);

		// Approve it. The throwaway org has exactly one tier, so the tier picker
		// is skipped and the application completes straight away.
		await ownerPage.getByRole('button', { name: `Approve request from ${followerName}` }).click();
		await expect(
			ownerPage.getByRole('button', { name: `Approve request from ${followerName}` })
		).toBeHidden({ timeout: 15_000 });
		await ownerContext.close();

		// The member-side CTA is now the membership badge, tier and all.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Membership status: Active')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Membership tier: General membership')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeHidden();

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
