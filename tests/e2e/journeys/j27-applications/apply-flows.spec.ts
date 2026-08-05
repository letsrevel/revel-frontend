import { test, expect } from '../../support/fixtures';
import {
	applyViaApi,
	approveApplication,
	createOrganization,
	createVerifiedUser,
	myApplicationFor,
	rejectApplication,
	setOrgMembershipPolicy,
	type ThrowawayUser
} from '../../support/factories';
import { pageAs } from '../../support/session';
import {
	applicationRow,
	membershipCard,
	membershipPath,
	tierCard
} from '../../support/membership-locators';
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
// Three backend behaviours the specs are built on, verified live against this
// branch:
//   * a TIER-BEARING apply on an ungated org completes on the spot — the
//     membership exists before any UI is opened;
//   * a TIER-LESS apply stays PENDING for staff, whatever the org's approval
//     policy, because the backend never resolves a default tier on the
//     member's behalf;
//   * eligibility is TIER-SCOPED: `MembershipEligibilityService` buckets a
//     user's applications by `tier_id` (tier-less rows live in their own
//     `None` bucket), so an application only ever colours the verdict for the
//     tier it names. An arrange whose row must be visible on a tier CARD has
//     to name that tier — see the re-apply test.
//
// The second bullet used to read "all the UI ever sends, since ApplyDialog
// posts no tier". That is no longer true and was the blind spot #723 was filed
// about: since #720/#727 a member picks a tier on /org/[slug]/membership and
// ApplyDialog posts its `tier_id`, so the UI path is the TIER-BEARING one.
// Tier-less applies survive only as ARRANGE steps for the account-hub surfaces
// (which list applications whatever their tier) and as the legacy rows staff
// still have to name a tier for. The member-facing tier selection itself is
// covered by tier-selection.spec.ts.
//
// Approval alone does NOT create the membership: the state machine advances
// when the MEMBER reads the application, which the account hub's Applications
// section does on every mount.

/** The member's own application id, for admin-side arranges after a UI apply.
 *  `myApplicationFor` reads the LIST endpoint, which is a plain read — unlike
 *  GET /me/applications/{id}, which advances the state machine and would do the
 *  very work under test. */
async function findApplicationId(user: ThrowawayUser, orgSlug: string): Promise<string> {
	const application = await myApplicationFor(user, orgSlug);
	if (!application?.id) {
		throw new Error(`No application for ${user.email} at ${orgSlug}`);
	}
	return application.id;
}

/** The tier a post-save signal gives every new org — the one the UI applies to. */
const DEFAULT_TIER = 'General membership';

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
		await expect(
			page.getByTestId('status-badge').filter({ hasText: 'Membership status: Active' })
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByTestId('status-badge').filter({ hasText: `Membership tier: ${DEFAULT_TIER}` })
		).toBeVisible();

		// The membership grid withdraws the offer tier by tier. The per-tier member
		// badge is the settle signal: those CTAs resolve asynchronously, so
		// asserting the absence of a Join button without it would pass while the
		// verdicts were still in flight.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		await expect(
			tierCard(page, DEFAULT_TIER)
				.getByTestId('status-badge')
				.filter({ hasText: 'You are a member of this organization' })
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /^Join / })).toHaveCount(0);

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
			applicationRow(page, 'Closed', org.name)
				.getByTestId('status-badge')
				.filter({ hasText: 'Application status: Completed' })
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
		// The membership grid is where a tier — and therefore a join — is chosen;
		// the org landing page only points at it (#720).
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const generalTier = tierCard(page, DEFAULT_TIER);
		await expect(generalTier).toBeVisible({ timeout: 15_000 });
		await generalTier.getByRole('button', { name: `Join ${DEFAULT_TIER}` }).click();
		// The tier, not the org, names the dialog once there is one.
		const applyDialog = page.getByRole('dialog', { name: `Join ${DEFAULT_TIER}` });
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
		await expect(generalTier.getByRole('button', { name: 'Application pending' })).toBeDisabled();

		// The account hub tracks it as in-progress.
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		await expect(
			applicationRow(page, 'In progress', org.name)
				.getByTestId('status-badge')
				.filter({ hasText: 'Application status: Pending' })
		).toBeVisible({ timeout: 15_000 });
		await expect(membershipCard(page, org.name)).toBeHidden();

		// Staff approve, WITHOUT naming a tier — and that is the assertion. Since
		// #727 the UI's apply carries `tier_id`, so the application resolves its
		// own; the backend only makes staff pick for a tier-less (legacy) row.
		// Were ApplyDialog to stop sending the tier, this approve would have
		// nothing to resolve and the completion below would never arrive.
		const applicationId = await findApplicationId(applicant, org.slug);
		await approveApplication(org.owner, org.slug, applicationId);

		// Approval is not the membership: the row only completes when the member
		// reads it, and each remount of the Applications section re-fires that
		// state-advancing GET. Poll by reloading, not by waiting in place.
		await expect(async () => {
			await gotoHydrated(page, '/account/memberships');
			await waitForClientAuth(page);
			await expect(membershipCard(page, org.name)).toBeVisible({ timeout: 10_000 });
			await expect(
				applicationRow(page, 'Closed', org.name)
					.getByTestId('status-badge')
					.filter({ hasText: 'Application status: Completed' })
			).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 30_000 });

		await page.context().close();
	});

	test('a rejected application can be re-applied for from the membership page', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);

		// Approval required, so the RE-apply — which now carries a tier, since the
		// UI sends one (#727) — parks as pending instead of completing outright.
		// Without it the second application would settle instantly and both rows
		// would land in "Closed", where they are indistinguishable.
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });

		// API ARRANGE, so the rejection under test is not itself produced by the
		// UI — but it names the TIER, and that is load-bearing. Applications are
		// tier-scoped on the backend (`MembershipEligibilityService` keys them by
		// `tier_id`, with `None` its own bucket), so a tier-less rejection is
		// invisible to every tier card's verdict and the grid would keep offering
		// a plain Join. This arrange used to be tier-less and passed only while
		// the CTA lived on the org landing page, where the verdict was tier-less
		// too; #720 moved it onto the tier.
		const first = await applyViaApi(applicant, org.slug, {
			tierId: org.defaultTierId,
			notes: 'E2E: first try'
		});
		expect(first.status).toBe('pending');
		await rejectApplication(org.owner, org.slug, first.applicationId);

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		// The verdict turns the join CTA into a re-apply one — a rejection is not
		// a dead end. Scoped to the tier because the verdict is: only the card for
		// the tier that was rejected carries the offer.
		const generalTier = tierCard(page, DEFAULT_TIER);
		const reapplyButton = generalTier.getByRole('button', { name: 'Re-apply for membership' });
		await expect(reapplyButton).toBeVisible({ timeout: 15_000 });
		await reapplyButton.click();

		const reapplyDialog = page.getByRole('dialog', { name: `Re-apply to ${DEFAULT_TIER}` });
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
			applicationRow(page, 'Closed', org.name)
				.getByTestId('status-badge')
				.filter({ hasText: 'Application status: Rejected' })
		).toBeVisible({ timeout: 15_000 });
		await expect(
			applicationRow(page, 'In progress', org.name)
				.getByTestId('status-badge')
				.filter({ hasText: 'Application status: Pending' })
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
			applicationRow(page, 'Closed', org.name)
				.getByTestId('status-badge')
				.filter({ hasText: 'Application status: Cancelled' })
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('list', { name: 'In progress' })).toBeHidden();

		await page.context().close();
	});
});
