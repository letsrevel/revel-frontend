import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaire,
	createEventSeries,
	createOrganization,
	createSeriesPass,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// FE #1183: a season pass over events that have ADMISSION questionnaires. The
// pass card lists the missing questionnaires ("Complete these questionnaires
// first") and disables Buy; each link opens the questionnaire in its own event
// and brings the buyer back to the pass; Buy enables once all are answered.
// (Purchase itself is covered by j26.)

const QUESTION = 'Do you agree to the community guidelines?';
const CORRECT = 'Yes, I agree to the guidelines';

function questionnaire(name: string): Record<string, unknown> {
	return {
		name,
		evaluation_mode: 'automatic',
		multiplechoicequestion_questions: [
			{
				question: QUESTION,
				is_mandatory: true,
				is_fatal: true,
				shuffle_options: false,
				options: [
					{ option: CORRECT, is_correct: true, order: 0 },
					{ option: 'No, I do not agree', order: 1 }
				]
			}
		]
	};
}

test.describe('J31 series pass questionnaires @p2', () => {
	test('missing questionnaires block Buy, each returns to the pass, and Buy enables when all are done', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const org = await createOrganization({ publicVisibility: true });
		const series = await createEventSeries(org.owner, org.slug);
		const [eventA, eventB] = await Promise.all([
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id }
			}),
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id }
			})
		]);
		const [qA, qB] = await Promise.all([
			attachQuestionnaire(eventA, questionnaire('E2E Pass Guidelines A'), org.owner),
			attachQuestionnaire(eventB, questionnaire('E2E Pass Guidelines B'), org.owner)
		]);
		const pass = await createSeriesPass(org.owner, series.id, {
			payment_method: 'free',
			price: '0.00',
			tier_links: [
				{ event_id: eventA.id, tier_id: eventA.freeTierId as string },
				{ event_id: eventB.id, tier_id: eventB.freeTierId as string }
			]
		});
		const buyer = await createVerifiedUser('PassBuyer');

		const page = await pageAs(browser, buyer);
		try {
			await gotoHydrated(page, series.path);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: pass.name })).toBeVisible({ timeout: 15_000 });

			const buy = page.getByRole('button', { name: 'Get season pass' });
			await expect(page.getByText('Complete these questionnaires first')).toBeVisible({
				timeout: 15_000
			});
			await expect(buy).toBeDisabled();

			for (const q of [qA, qB]) {
				await page.getByRole('link', { name: `Complete the questionnaire ${q.name}` }).click();
				await page.waitForURL(/\/questionnaire\//);
				await page.waitForLoadState('networkidle');
				const radio = page.getByRole('radio', { name: CORRECT });
				const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
				const seriesUrl = new RegExp(`/series/${series.slug}`);
				await expect(async () => {
					if (seriesUrl.test(page.url())) return;
					await radio.check();
					await expect(radio).toBeChecked();
					await submit.click();
					await page.waitForURL(seriesUrl, { timeout: 8_000 });
				}).toPass({ timeout: 40_000 });
				await waitForClientAuth(page);
			}

			// Auto-evaluation lands just after the redirect: reload until Buy enables.
			await expect(async () => {
				await gotoHydrated(page, series.path);
				await expect(page.getByRole('button', { name: 'Get season pass' })).toBeEnabled({
					timeout: 3_000
				});
			}).toPass({ timeout: 40_000 });
			await expect(page.getByText('Complete these questionnaires first')).toHaveCount(0);
		} finally {
			await page.context().close();
		}
	});
});
