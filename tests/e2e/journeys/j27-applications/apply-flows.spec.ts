import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	applyViaApi,
	approveApplication,
	createOrganization,
	createVerifiedUser,
	rejectApplication,
	setOrgMembershipPolicy,
	type ThrowawayUser
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { applicationRow, membershipCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J27.2–27.4 (USER_JOURNEYS.md) — the four ways a membership application can
// end: instant completion, staff approval, rejection → re-apply, and the
// member withdrawing it.
//
// Isolation: every test arranges its OWN org (throwaway owner, one
// auto-created "General membership" tier) and its own applicant, so parallel
// projects/workers and a `retries: 1` re-run never share an application.
//
// Two backend behaviours the specs are built on, verified live against this
// branch:
//   * a TIER-BEARING apply on an ungated org completes on the spot — the
//     membership exists before any UI is opened;
//   * a TIER-LESS apply (all the UI ever sends, since ApplyDialog posts no
//     tier) stays PENDING for staff, whatever the org's approval policy.
// Approval alone does NOT create the membership: the state machine advances
// when the MEMBER reads the application, which the account hub's Applications
// section does on every mount.

/** The member's own application id, for admin-side arranges after a UI apply.
 *  The LIST endpoint is a plain read — unlike GET /me/applications/{id}, which
 *  advances the state machine and would do the very work under test. */
async function findApplicationId(user: ThrowawayUser, orgSlug: string): Promise<string> {
	const api = await ApiClient.login(user.email, user.password);
	const page = await api.get<{ results: Array<{ id?: string | null; organization_slug: string }> }>(
		'/api/me/applications'
	);
	const application = page.results.find((a) => a.organization_slug === orgSlug);
	if (!application?.id) {
		throw new Error(`No application for ${user.email} at ${orgSlug}`);
	}
	return application.id;
}

test.describe('j27 application flows @p2', () => {
	test('tier-bearing apply completes instantly and shows up as a membership', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);

		// No approval requirement, no questionnaire, and a tier on the request →
		// the backend has nothing left to gate on and grants membership outright.
		const outcome = await applyViaApi(applicant, org.slug, { tierId: org.defaultTierId });
		expect(outcome.status).toBe('completed');
		expect(outcome.nextStep).toBeNull();

		const page = await pageAs(browser, applicant);

		// The org page reports it server-side: status + tier badges, not a CTA.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Membership status: Active')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Membership tier: General membership')).toBeVisible();
		await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeHidden();

		// …and the account hub lists both halves: the membership card, and the
		// application itself already settled under "Closed".
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		const card = membershipCard(page, org.name);
		await expect(card).toBeVisible({ timeout: 15_000 });
		// The card's own status badge carries no aria-label — the text IS the
		// message (CSS-capitalized, so the DOM string is lowercase).
		await expect(card.getByText('active', { exact: true })).toBeVisible();
		await expect(
			applicationRow(page, 'Closed', org.name).getByLabel('Application status: Completed')
		).toBeVisible();
		await expect(page.getByRole('list', { name: 'In progress' })).toBeHidden();

		await page.context().close();
	});

	test('approval-gated apply waits for staff, then completes on the next read', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		await page.getByRole('button', { name: `Join ${org.name}` }).click();
		const applyDialog = page.getByRole('dialog', { name: `Join ${org.name}` });
		await expect(applyDialog).toBeVisible();
		await applyDialog.getByLabel('Message (optional)').fill('E2E: approval pipeline');
		await applyDialog.getByRole('button', { name: 'Send application' }).click();

		// The outcome re-titles the dialog in place; "Application received" (not
		// "You're in!") is the whole point — approval is still owed.
		const outcomeDialog = page.getByRole('dialog', { name: 'Application received' });
		await expect(outcomeDialog).toBeVisible({ timeout: 15_000 });
		await expect(
			outcomeDialog.getByText(
				"Your application is with the organization for review. You'll hear back once they decide."
			)
		).toBeVisible();
		await closeDialog(page, outcomeDialog);
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeDisabled();

		// The account hub tracks it as in-progress.
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		await expect(
			applicationRow(page, 'In progress', org.name).getByLabel('Application status: Pending')
		).toBeVisible({ timeout: 15_000 });
		await expect(membershipCard(page, org.name)).toBeHidden();

		// Staff approve. A UI apply carries no tier, so the approval must name one.
		const applicationId = await findApplicationId(applicant, org.slug);
		await approveApplication(org.owner, org.slug, applicationId, org.defaultTierId);

		// Approval is not the membership: the row only completes when the member
		// reads it, and each remount of the Applications section re-fires that
		// state-advancing GET. Poll by reloading, not by waiting in place.
		await expect(async () => {
			await gotoHydrated(page, '/account/memberships');
			await waitForClientAuth(page);
			await expect(membershipCard(page, org.name)).toBeVisible({ timeout: 10_000 });
			await expect(
				applicationRow(page, 'Closed', org.name).getByLabel('Application status: Completed')
			).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 30_000 });

		await page.context().close();
	});

	test('a rejected application can be re-applied for from the org page', async ({ browser }) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);

		// Tier-less (what the UI sends) so the application is staff's to decide.
		const first = await applyViaApi(applicant, org.slug, { notes: 'E2E: first try' });
		expect(first.status).toBe('pending');
		await rejectApplication(org.owner, org.slug, first.applicationId);

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		// The verdict turns the join CTA into a re-apply one — a rejection is not
		// a dead end.
		const reapplyButton = page.getByRole('button', { name: 'Re-apply for membership' });
		await expect(reapplyButton).toBeVisible({ timeout: 15_000 });
		await reapplyButton.click();

		const reapplyDialog = page.getByRole('dialog', { name: `Re-apply to ${org.name}` });
		await expect(reapplyDialog).toBeVisible();
		await reapplyDialog.getByLabel('Message (optional)').fill('E2E: second try');
		await reapplyDialog.getByRole('button', { name: 'Send application' }).click();

		const outcomeDialog = page.getByRole('dialog', { name: 'Application received' });
		await expect(outcomeDialog).toBeVisible({ timeout: 15_000 });
		await closeDialog(page, outcomeDialog);

		// Both rows coexist in the account hub — the settled one below, the new
		// one above. (Both <article>s are named after the org; the lists are what
		// tells them apart.)
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		await expect(
			applicationRow(page, 'Closed', org.name).getByLabel('Application status: Rejected')
		).toBeVisible({ timeout: 15_000 });
		await expect(
			applicationRow(page, 'In progress', org.name).getByLabel('Application status: Pending')
		).toBeVisible();

		await page.context().close();
	});

	test('a member can cancel their own pending application', async ({ browser }) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		const application = await applyViaApi(applicant, org.slug, { notes: 'E2E: to withdraw' });
		expect(application.status).toBe('pending');

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);

		const openRow = applicationRow(page, 'In progress', org.name);
		await expect(openRow).toBeVisible({ timeout: 15_000 });
		await openRow.getByRole('button', { name: 'Cancel application' }).click();

		// A plain (non-bits-ui) confirm dialog: labelled by its title, confirmed
		// by the shared "Confirm" button.
		const confirmDialog = page.getByRole('dialog', { name: 'Cancel this application?' });
		await expect(confirmDialog).toBeVisible();
		await expect(
			confirmDialog.getByText(`Your application to ${org.name} will be withdrawn.`)
		).toBeVisible();
		await confirmDialog.getByRole('button', { name: 'Confirm' }).click();

		await expect(page.getByText('Application cancelled.')).toBeVisible({ timeout: 15_000 });

		// The row settles into "Closed", and nothing is left in progress.
		await expect(
			applicationRow(page, 'Closed', org.name).getByLabel('Application status: Cancelled')
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('list', { name: 'In progress' })).toBeHidden();

		await page.context().close();
	});
});
