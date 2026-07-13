import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaire,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11 (USER_JOURNEYS.md) — conditional branching in the questionnaire fill
// flow: a dependent question appears only while its triggering option is
// selected (and gates submission while visible + mandatory), and the
// per-user option shuffle is STABLE across reloads (seeded server-side from
// questionnaire id + user pk).
//
// Arranged from scratch: the seeded questionnaire with conditional content
// (Org Beta's membership application) is org-level with no FE fill route, so
// an own event + admission questionnaire is the only way to drive this UI.
// Everything lives in a THROWAWAY org: questionnaires land on the org's
// admin index, and piling E2E ones onto Org Alpha crowds the seeded
// wine-tasting card that manual-review navigates by.

const TRIGGER = 'Yes, I have restrictions';
const OTHER = 'No restrictions';
const CONDITIONAL_QUESTION = 'Please describe your restrictions';
const SHUFFLED_OPTIONS = ['Workshops', 'Talks', 'Networking', 'Panels', 'Demos'];

test.describe('J11 conditional branching @p2', () => {
	test('dependent question toggles with its option, shuffle is reload-stable', async ({
		browser
	}) => {
		const org = await createOrganization();
		const event = await createTicketedEvent({ owner: org.owner, orgSlug: org.slug });
		await attachQuestionnaire(
			event,
			{
				multiplechoicequestion_questions: [
					{
						question: 'Do you have any dietary restrictions?',
						is_mandatory: true,
						order: 0,
						shuffle_options: false,
						options: [
							{
								option: TRIGGER,
								order: 0,
								conditional_ft_questions: [
									{ question: CONDITIONAL_QUESTION, is_mandatory: true, order: 0 }
								]
							},
							{ option: OTHER, order: 1 }
						]
					},
					{
						question: 'Which sessions interest you?',
						is_mandatory: false,
						order: 1,
						shuffle_options: true,
						options: SHUFFLED_OPTIONS.map((option, order) => ({ option, order }))
					}
				]
			},
			org.owner
		);

		const user = await createVerifiedUser('Branching');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await page
			.getByRole('button', { name: 'Complete Questionnaire' })
			.filter({ visible: true })
			.first()
			.click();
		await page.waitForURL(/\/questionnaire\//);
		// Let the questionnaire queries settle — interactions during the
		// settling re-renders are silently dropped (see fill-auto-eval).
		await page.waitForLoadState('networkidle');

		// The per-user option shuffle is deterministic: reloading renders the
		// second question's options in the exact same order.
		const shuffledGroup = page
			.getByRole('radiogroup')
			.filter({ has: page.getByRole('radio', { name: SHUFFLED_OPTIONS[0] }) });
		const orderBefore = await shuffledGroup.ariaSnapshot();
		await page.reload();
		await page.waitForLoadState('networkidle');
		expect(await shuffledGroup.ariaSnapshot()).toBe(orderBefore);

		// The dependent question is hidden until its trigger option is picked.
		const conditional = page.getByText(CONDITIONAL_QUESTION);
		const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
		await expect(conditional).toBeHidden();

		await expect(async () => {
			await page.getByRole('radio', { name: OTHER }).check();
			await expect(page.getByRole('radio', { name: OTHER })).toBeChecked();
		}).toPass({ timeout: 30_000 });
		await expect(conditional).toBeHidden();
		// All visible mandatory questions answered → submittable.
		await expect(submit).toBeEnabled();

		// Switching to the trigger reveals the mandatory dependent question,
		// which blocks submission until answered.
		await page.getByRole('radio', { name: TRIGGER }).check();
		await expect(conditional).toBeVisible();
		await expect(submit).toBeDisabled();
		await page.getByPlaceholder('Type your answer here...').fill('Vegetarian, no nuts.');
		await expect(submit).toBeEnabled();

		// Toggling away hides it again (and un-blocks submission without it).
		await page.getByRole('radio', { name: OTHER }).check();
		await expect(conditional).toBeHidden();
		await expect(submit).toBeEnabled();

		// Submit the branch WITH the conditional answer — the full journey.
		// The event-page check must anchor at the END of the path: the fill
		// route (/events/…/<slug>/questionnaire/<id>) CONTAINS the event slug.
		const eventPageUrl = new RegExp(`/${event.slug}(?:\\?|$)`);
		await page.getByRole('radio', { name: TRIGGER }).check();
		await page.getByPlaceholder('Type your answer here...').fill('Vegetarian, no nuts.');
		await expect(async () => {
			if (eventPageUrl.test(page.url())) return;
			await submit.click();
			await page.waitForURL(eventPageUrl, { timeout: 8_000 });
		}).toPass({ timeout: 40_000 });

		// Manual evaluation → the gate flips to "under review".
		await expect(
			page
				.getByText(/being reviewed|under review/i)
				.filter({ visible: true })
				.first()
		).toBeVisible({ timeout: 20_000 });

		await context.close();
	});
});
