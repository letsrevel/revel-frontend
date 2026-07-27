import { test, expect } from '../../support/fixtures';
import {
	applyViaApi,
	createMembershipQuestionnaire,
	createOrganization,
	createVerifiedUser,
	setOrgMembershipPolicy,
	MEMBERSHIP_QUESTION
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { membershipCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J27.1–27.3 (USER_JOURNEYS.md) — the membership QUESTIONNAIRE gate: the org
// page's `submit_questionnaire` CTA, the org-scoped fill route it points at,
// and the two evaluation modes' outcomes (auto-graded → gate clears; manual →
// the member waits).
//
// Isolation: each test arranges its own org (throwaway owner), its own
// questionnaire and its own applicant, so parallel projects/workers and a
// `retries: 1` re-run never share a submission (which is one-shot per user).
//
// Live-verified behaviours these specs are built on:
//   * the CTA's href — and `eligibility.questionnaire_id` — carry the INNER
//     Questionnaire id, NOT the OrganizationQuestionnaire wrapper id that
//     `createMembershipQuestionnaire` returns and that
//     `default_membership_questionnaire_id` stores. Test 1 asserts the two
//     apart explicitly.
//   * submitting a membership questionnaire NEVER renders the page's
//     "Questionnaire approved" panel, not even when the automatic grader
//     passes it: the grader is queued on commit (`transaction.on_commit`), so
//     the 200 carries `requires_evaluation: true` and no verdict — the page
//     toasts "Questionnaire submitted …" and returns to the org page either
//     way. The panel is reachable only for `requires_evaluation: false`, which
//     is why its copy is neutral about WHO evaluates (#697). The modes diverge
//     on what the org page says NEXT — join vs. still waiting.
//   * clearing the questionnaire gate is not joining. It only turns the CTA
//     back into a plain "Join" — the application is still owed.

test.describe('j27 membership questionnaire @p2', () => {
	test('an auto-graded questionnaire clears the join gate and the applicant becomes a member', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		// Multiple choice with one correct option and `min_score: 0` — the house
		// pattern for deterministic inline grading (no LLM anywhere near an E2E run).
		const wrapper = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'automatic'
		});
		await setOrgMembershipPolicy(org.owner, org.slug, { defaultQuestionnaireId: wrapper.id });

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		// The gate replaces the join CTA outright: there is nothing to apply for
		// until the questionnaire is on file.
		const questionnaireCta = page.getByRole('link', {
			name: 'Fill in the membership questionnaire'
		});
		await expect(questionnaireCta).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeHidden();

		await questionnaireCta.click();
		await page.waitForURL('**/questionnaire/**');

		// The route takes the INNER questionnaire id. Linking the wrapper id here
		// (the one the org policy stores) is the mistake this asserts against — it
		// would 404 the fill page.
		const routeId = new URL(page.url()).pathname.split('/').pop();
		expect(routeId).toBeTruthy();
		expect(routeId).not.toBe(wrapper.id);

		await expect(page.getByRole('heading', { name: 'Membership questionnaire' })).toBeVisible();
		await expect(page.getByText(`${org.name} asks new members to fill this in.`)).toBeVisible();
		await expect(page.getByText(MEMBERSHIP_QUESTION.automatic.question)).toBeVisible();

		// Submit stays disabled until every mandatory question is answered — an
		// empty submission would score 0 and burn the attempt (#596).
		const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
		await expect(submit).toBeDisabled();
		await page
			.getByRole('radio', { name: MEMBERSHIP_QUESTION.automatic.correct, exact: true })
			.click();
		await expect(submit).toBeEnabled();
		await submit.click();

		// Even a passing auto-graded submission takes the PENDING exit — the grader
		// is queued on commit, so the 200 carries no verdict (see the file header).
		// The confirmation is the toast plus the return trip.
		await expect(
			page.getByText("Questionnaire submitted — we'll let you know once it's been evaluated.")
		).toBeVisible({ timeout: 15_000 });
		await page.waitForURL(`**/org/${org.slug}`, { timeout: 15_000 });
		await expect(page.getByText('Questionnaire approved')).toBeHidden();

		// Grading is asynchronous, and the CTA is a cached client query: advance it
		// by re-reading the page, not by waiting in place. "Join" reappearing IS
		// the pass verdict — a failed one would leave a waiting/retry CTA.
		await expect(async () => {
			await gotoHydrated(page, `/org/${org.slug}`);
			await waitForClientAuth(page);
			await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });

		// Clearing the gate is not membership — the application is still owed, and
		// the ApplyDialog sends no tier, so a UI apply can only ever park as
		// pending (apply-flows.spec.ts owns that path). Here the apply is the
		// arrange for the last leg: with the questionnaire passed and no approval
		// requirement left, a tier-bearing apply completes on the spot.
		const outcome = await applyViaApi(applicant, org.slug, { tierId: org.defaultTierId });
		expect(outcome.status).toBe('completed');

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Membership status: Active')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Membership tier: General membership')).toBeVisible();
		await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeHidden();

		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		const card = membershipCard(page, org.name);
		await expect(card).toBeVisible({ timeout: 15_000 });
		// The card's status badge carries no aria-label — the text IS the message
		// (CSS-capitalized, so the DOM string is lowercase).
		await expect(card.getByText('active', { exact: true })).toBeVisible();

		await page.context().close();
	});

	test('a manually-graded questionnaire leaves the applicant waiting for review', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Applicant')
		]);
		// Free text, for a human to read — nothing grades itself here.
		const wrapper = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'manual'
		});
		await setOrgMembershipPolicy(org.owner, org.slug, { defaultQuestionnaireId: wrapper.id });

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		await page.getByRole('link', { name: 'Fill in the membership questionnaire' }).click();
		await page.waitForURL('**/questionnaire/**');
		await expect(page.getByRole('heading', { name: 'Membership questionnaire' })).toBeVisible();

		// The textarea is labelled by the question itself (plus the required "*").
		await page.getByLabel(MEMBERSHIP_QUESTION.manual.question).fill('E2E: I like this org.');
		await page.getByRole('button', { name: 'Submit Questionnaire' }).click();

		await expect(
			page.getByText("Questionnaire submitted — we'll let you know once it's been evaluated.")
		).toBeVisible({ timeout: 15_000 });
		await page.waitForURL(`**/org/${org.slug}`, { timeout: 15_000 });

		// `wait_for_questionnaire_evaluation` → the disabled waiting CTA plus the
		// account-hub link. No re-fill link: one submission is all the member gets
		// until staff grade it.
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeDisabled({
			timeout: 15_000
		});
		await expect(page.getByRole('link', { name: 'Track your application' })).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Fill in the membership questionnaire' })
		).toBeHidden();
		await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeHidden();

		// …and yet there is nothing to track YET: a questionnaire submission is not
		// an application, so the hub stays empty on both halves. (The waiting CTA
		// above is the questionnaire's own state, not an application's.)
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		await expect(
			page
				.getByRole('region', { name: 'Applications' })
				.getByText(
					'No applications yet. When you apply to join an organization, you can track it here.'
				)
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('list', { name: 'In progress' })).toBeHidden();
		await expect(membershipCard(page, org.name)).toBeHidden();

		await page.context().close();
	});
});
