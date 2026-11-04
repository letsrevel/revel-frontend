import { test, expect } from '../../support/fixtures';
import {
	createMembershipQuestionnaire,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	setOrgMembershipPolicy,
	MEMBERSHIP_QUESTION
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { tierCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #1154 (with backend #1300): a non-member on a MEMBERS-ONLY event follows the
// event's "Join Organization" CTA to the membership grid, and comes BACK to the
// event once their part is done. The event then shows the pending state rather
// than offering "Join Organization" again.
//
// Two entry routes, one per waiting state:
//   1. manual membership questionnaire → submit → straight back to the event,
//      which reads "Questionnaire under review"
//      (`wait_for_membership_questionnaire_evaluation`).
//   2. manual approval, no questionnaire → apply → the outcome dialog offers
//      "Back to the event" (a dialog never navigates by itself), and the event
//      reads "Application pending" (`wait_for_membership_approval`).
//
// Isolation: every test arranges its own org (throwaway owner), event and
// applicant, so parallel projects and retries never share a submission.

const DEFAULT_TIER = 'General membership';

test.describe('j27 members-only event round trip @p2', () => {
	test('a pending membership questionnaire returns the applicant to the event, which shows it under review', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		const wrapper = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'manual'
		});
		await setOrgMembershipPolicy(org.owner, org.slug, { defaultQuestionnaireId: wrapper.id });
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			event: { event_type: 'members-only' }
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await page.getByRole('button', { name: 'Join Organization' }).first().click();
		// The membership grid, carrying the event to come back to.
		await page.waitForURL(
			(url) =>
				url.pathname === `/org/${org.slug}/membership` &&
				url.searchParams.get('returnUrl') === event.path,
			{ timeout: 15_000 }
		);
		await waitForClientAuth(page);
		await expect(page.getByRole('link', { name: 'Back to the event' })).toHaveAttribute(
			'href',
			event.path
		);

		await tierCard(page, DEFAULT_TIER)
			.getByRole('link', { name: 'Fill in the membership questionnaire' })
			.click();
		await page.waitForURL('**/questionnaire/**');
		await page.getByLabel(MEMBERSHIP_QUESTION.manual.question).fill('E2E: from the event.');
		await page.getByRole('button', { name: 'Submit Questionnaire' }).click();

		// Pending review → back on the EVENT, not the org page.
		await page.waitForURL((url) => url.pathname === event.path, { timeout: 15_000 });
		await waitForClientAuth(page);
		await expect(
			page.getByRole('button', { name: 'Questionnaire under review' }).first()
		).toBeDisabled({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Join Organization' })).toHaveCount(0);
		// No application exists yet, so the tracking link points at the org's
		// membership page (which shows the per-tier verdict), not the empty hub.
		await expect(
			page.getByRole('link', { name: 'View membership options' }).first()
		).toHaveAttribute('href', `/org/${org.slug}/membership`);

		await page.context().close();
	});

	test('a pending application offers the way back to the event, which shows it pending', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			event: { event_type: 'members-only' }
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Join Organization' }).first().click();
		await page.waitForURL((url) => url.pathname === `/org/${org.slug}/membership`, {
			timeout: 15_000
		});
		await waitForClientAuth(page);

		await tierCard(page, DEFAULT_TIER)
			.getByRole('button', { name: `Join ${DEFAULT_TIER}` })
			.click();
		const applyDialog = page.getByRole('dialog', { name: `Join ${DEFAULT_TIER}` });
		await applyDialog.getByRole('button', { name: 'Send application' }).click();

		const outcomeDialog = page.getByRole('dialog', { name: 'Application received' });
		await expect(outcomeDialog).toBeVisible({ timeout: 15_000 });
		await outcomeDialog.getByRole('link', { name: 'Back to the event' }).click();

		await page.waitForURL((url) => url.pathname === event.path, { timeout: 15_000 });
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Application pending' }).first()).toBeDisabled({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Join Organization' })).toHaveCount(0);
		await expect(
			page.getByRole('link', { name: 'Track your application' }).first()
		).toHaveAttribute('href', '/account/memberships');

		await page.context().close();
	});
});
