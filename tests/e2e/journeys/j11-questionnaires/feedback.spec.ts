import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaire,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	getUserId,
	rsvpOnBehalf
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11 (USER_JOURNEYS.md) — post-event feedback questionnaire: an attendee of
// a FINISHED event gets the "Feedback Available" panel on the event page,
// fills the feedback form once, and the offer disappears (one submission per
// user/event, feedback is never evaluated).
//
// The seeded NYE-gala feedback fixture is deliberately NOT used: charlie's
// one-shot submission would burn the seed for the sibling browser project and
// every re-run. Instead the spec arranges its own already-finished event in a
// throwaway org (the API accepts past dates) and creates the attendance
// through the admin on-behalf RSVP endpoint, which skips the "event is over"
// eligibility gates the public RSVP API enforces.

const QUESTION = 'Did you enjoy the event?';
const ANSWER = 'Yes, I loved it';

test.describe('J11 feedback questionnaire @p3', () => {
	test('past-event attendee gives feedback once', async ({ browser }) => {
		test.setTimeout(180_000);

		const org = await createOrganization();
		const dayMs = 24 * 60 * 60 * 1000;
		const start = new Date(Date.now() - 3 * dayMs);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: {
				requires_ticket: false,
				start: start.toISOString(),
				end: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString()
			}
		});
		await attachQuestionnaire(
			event,
			{
				questionnaire_type: 'feedback',
				requires_evaluation: false,
				multiplechoicequestion_questions: [
					{
						question: QUESTION,
						is_mandatory: true,
						shuffle_options: false,
						options: [
							{ option: ANSWER, order: 0 },
							{ option: 'Not really', order: 1 }
						]
					}
				]
			},
			org.owner
		);
		const attendee = await createVerifiedUser('Feedback');
		await rsvpOnBehalf(org.owner, event.id, await getUserId(attendee), 'yes');

		const context = await browser.newContext();
		await authenticateContext(context, attendee);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// The finished event greets the attendee with the feedback offer.
		await expect(
			page.getByText('Feedback Available').filter({ visible: true }).first()
		).toBeVisible({ timeout: 15_000 });
		await page
			.getByRole('link', { name: 'Give Feedback' })
			.or(page.getByRole('button', { name: 'Give Feedback' }))
			.filter({ visible: true })
			.first()
			.click();
		await page.waitForURL(/\/questionnaire\//);
		await page.waitForLoadState('networkidle');

		// Answer + submit (same drop-proof loop as the admission fills). Unlike
		// admission questionnaires the page does NOT navigate back — with no
		// evaluation to run it lands on the "You're all set!" completion status.
		const radio = page.getByRole('radio', { name: ANSWER });
		const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
		const done = page.getByRole('status').filter({ hasText: "You're all set!" });
		await expect(async () => {
			if (await done.isVisible()) return;
			await radio.check();
			await expect(radio).toBeChecked();
			await expect(submit).toBeEnabled();
			await submit.click();
			await expect(done).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 40_000 });

		// One-shot: with the submission recorded, the offer is gone for good.
		await expect(async () => {
			await gotoHydrated(page, event.path);
			await expect(page.getByText('Feedback Available')).toBeHidden({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });

		await context.close();
	});
});
