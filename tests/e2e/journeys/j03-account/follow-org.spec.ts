import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createVerifiedUser,
	setOrgMembershipPolicy
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { membershipPath, tierCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J3.5 (USER_JOURNEYS.md) — follow an organization (with notification
// preferences), apply for membership with a message, and see the application
// land in the org admin's queue; unfollow at the end.
//
// The join flow is the eligibility CTA + ApplyDialog (PR② of the membership
// subscriptions work); the legacy "Request Membership" button is gone. Since
// #720 the CTA that opens that dialog lives on /org/[slug]/membership, next to
// the tier being joined — the landing page keeps only a pointer at the grid —
// and the apply carries that tier. The org therefore has to REQUIRE APPROVAL
// for the application to stay pending; a tier-bearing apply on an ungated org
// completes on the spot, and there would be no request for the admin queue leg
// below to show.
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
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });

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

		// Apply for membership with a message — on the tier grid, the only surface
		// that can name the tier the application will carry.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		const generalTier = tierCard(page, 'General membership');
		await expect(generalTier).toBeVisible({ timeout: 15_000 });
		await generalTier.getByRole('button', { name: 'Join General membership' }).click();
		const applyDialog = page.getByRole('dialog', { name: 'Join General membership' });
		await expect(applyDialog).toBeVisible();
		await applyDialog.getByLabel('Message (optional)').fill('E2E: please let me in');
		await applyDialog.getByRole('button', { name: 'Send application' }).click();

		// The outcome replaces the form in place, so the dialog is RE-TITLED —
		// approval is still owed, hence "Application received" (an auto-granted
		// membership would title it "You're in!").
		const outcomeDialog = page.getByRole('dialog', { name: 'Application received' });
		await expect(outcomeDialog).toBeVisible({ timeout: 15_000 });
		await expect(outcomeDialog.getByRole('link', { name: 'Track your application' })).toBeVisible();
		await closeDialog(page, outcomeDialog);

		// The CTA follows the refreshed eligibility verdict.
		await expect(generalTier.getByRole('button', { name: 'Application pending' })).toBeDisabled();

		// Both survive a round trip to the server: a fresh load of the LANDING page
		// still shows Following, and it still points at the grid.
		//
		// The landing CTA is MembershipCta's SUMMARY mode (no tier), and it does
		// NOT report the pending application — deliberately, and asserted here so
		// the difference is a decision rather than a hole. Eligibility is
		// tier-scoped on the backend, and this application names a tier; a
		// tier-less verdict cannot see it, and with N tiers there is no single
		// state for a summary to honestly report anyway. So the landing page keeps
		// the pointer at the grid…
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();
		// Scoped to the Membership landmark: the hero CTA and this section link
		// carry the SAME words, and `.first()` would quietly pick whichever came
		// out on top.
		await expect(
			page.getByRole('region', { name: 'Membership' }).getByRole('link', {
				name: 'View membership options'
			})
		).toHaveAttribute('href', membershipPath(org.slug));
		// The absence is the point, so it is asserted on TEXT rather than on a
		// role: #720 turned several membership CTAs from buttons into links, and a
		// `getByRole('button', …).toHaveCount(0)` would pass for the wrong reason
		// against any of them.
		await expect(page.getByText('Application pending')).toHaveCount(0);
		// …and the pending state is asserted where it lives: a fresh, cold load of
		// the GRID, which is what proves the application was persisted rather than
		// just optimistically rendered by the dialog that created it. Named on the
		// tier card, not page-globally: `toBeDisabled()` on a wrong element would
		// pass for the wrong reason.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		await expect(
			tierCard(page, 'General membership').getByRole('button', { name: 'Application pending' })
		).toBeDisabled({ timeout: 15_000 });

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
		await expect(
			page.getByTestId('status-badge').filter({ hasText: 'Membership status: Active' })
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByTestId('status-badge').filter({ hasText: 'Membership tier: General membership' })
		).toBeVisible();
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
