import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaireToSeries,
	createEventSeries,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J18 (USER_JOURNEYS.md) — series-level questionnaire: a questionnaire
// attached to the EVENT SERIES gates every event in it, and one approved
// submission (per_event stays false, the default) unlocks them ALL — the
// user passes on event A and event B opens without ever re-prompting.
//
// Isolation: throwaway org (questionnaires pollute the org's admin index),
// automatic MCQ evaluation (inline, deterministic), throwaway user.

const QUESTION = 'Will you follow the series code of conduct?';
const CORRECT = 'Yes, I will follow it';

test.describe('J18 series questionnaire @p3', () => {
	test('pass once on one event → every series event unlocked', async ({ browser }) => {
		test.setTimeout(180_000);

		const org = await createOrganization();
		const series = await createEventSeries(org.owner, org.slug);
		const seriesEvent = {
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false, event_series_id: series.id }
		};
		const [eventA, eventB] = await Promise.all([
			createTicketedEvent(seriesEvent),
			createTicketedEvent(seriesEvent)
		]);
		await attachQuestionnaireToSeries(
			series,
			{
				evaluation_mode: 'automatic',
				multiplechoicequestion_questions: [
					{
						question: QUESTION,
						is_mandatory: true,
						is_fatal: true,
						shuffle_options: false,
						options: [
							{ option: CORRECT, is_correct: true, order: 0 },
							{ option: 'No, rules are not for me', order: 1 }
						]
					}
				]
			},
			org.owner
		);

		const user = await createVerifiedUser('SeriesPass');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		try {
			// Both events start gated by the series questionnaire.
			await gotoHydrated(page, eventB.path);
			await waitForClientAuth(page);
			await expect(
				page
					.getByRole('button', { name: 'Complete Questionnaire' })
					.filter({ visible: true })
					.first()
			).toBeVisible({ timeout: 15_000 });

			// Pass it from event A.
			await gotoHydrated(page, eventA.path);
			await page
				.getByRole('button', { name: 'Complete Questionnaire' })
				.filter({ visible: true })
				.first()
				.click();
			await page.waitForURL(/\/questionnaire\//);
			await page.waitForLoadState('networkidle');
			const radio = page.getByRole('radio', { name: CORRECT });
			const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
			const eventAUrl = new RegExp(`/${eventA.slug}(?:\\?|$)`);
			await expect(async () => {
				if (eventAUrl.test(page.url())) return;
				await radio.check();
				await expect(radio).toBeChecked();
				await expect(submit).toBeEnabled();
				await submit.click();
				await page.waitForURL(eventAUrl, { timeout: 8_000 });
			}).toPass({ timeout: 40_000 });

			// Approved (inline auto-eval) → event A's gate yields to the RSVP card…
			await expect(async () => {
				await gotoHydrated(page, eventA.path);
				await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
					timeout: 3_000
				});
			}).toPass({ timeout: 30_000 });

			// …and event B is unlocked WITHOUT a second submission.
			await gotoHydrated(page, eventB.path);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByRole('button', { name: 'Complete Questionnaire' })).toBeHidden();
		} finally {
			await context.close();
		}
	});
});
