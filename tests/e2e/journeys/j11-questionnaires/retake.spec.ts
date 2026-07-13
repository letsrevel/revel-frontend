import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaire,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11 (USER_JOURNEYS.md) — max_attempts + cooldown: after a REJECTED
// submission the messaging surfaces on the EVENT ELIGIBILITY GATE (not the
// submit toast):
// - cooldown pending  → "Questionnaire not passed" + retry countdown +
//   disabled "Retry Available Soon" (next_step wait_to_retake_questionnaire),
// - attempts exhausted → "Questionnaire not passed" + failed count and NO
//   action at all (the backend omits next_step entirely),
// - attempts remaining & no cooldown → the gate re-arms with "Complete
//   Questionnaire" and a correct retake unlocks the event.
//
// Every path arranges its own NON-TICKETED event (the RSVP surface renders
// the full IneligibilityMessage headers; the ticketed sidebar renders only
// short next-step text), an AUTOMATIC MCQ-only questionnaire (deterministic
// inline evaluation, no LLM: one fatal question, wrong option → REJECTED),
// and its own throwaway user — submissions/attempts are per-user state.
// Each event lives in a THROWAWAY org: questionnaires land on the org's
// admin index, and piling E2E ones onto Org Alpha crowds the seeded
// wine-tasting card that manual-review navigates by.

const QUESTION = 'Do you agree to the community guidelines?';
const CORRECT = 'Yes, I agree to the guidelines';
const WRONG = 'No, I do not agree';

async function arrangeGatedEvent(options: { maxAttempts: number; cooldownSeconds?: number }) {
	const org = await createOrganization();
	const event = await createTicketedEvent({
		owner: org.owner,
		orgSlug: org.slug,
		freeTier: false,
		event: { requires_ticket: false }
	});
	await attachQuestionnaire(
		event,
		{
			evaluation_mode: 'automatic',
			max_attempts: options.maxAttempts,
			can_retake_after: options.cooldownSeconds ?? null,
			multiplechoicequestion_questions: [
				{
					question: QUESTION,
					is_mandatory: true,
					is_fatal: true,
					shuffle_options: false,
					options: [
						{ option: CORRECT, is_correct: true, order: 0 },
						{ option: WRONG, order: 1 }
					]
				}
			]
		},
		org.owner
	);
	return event;
}

async function openEventAs(
	browser: import('@playwright/test').Browser,
	label: string,
	path: string
) {
	const user = await createVerifiedUser(label);
	const context = await browser.newContext();
	await authenticateContext(context, user);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return page;
}

/** Enter the questionnaire from the gate and submit the given answer. */
async function submitAnswer(
	page: import('@playwright/test').Page,
	eventSlug: string,
	answer: string
): Promise<void> {
	await page
		.getByRole('button', { name: 'Complete Questionnaire' })
		.filter({ visible: true })
		.first()
		.click();
	await page.waitForURL(/\/questionnaire\//);
	// Settle before answering: interactions during the initial re-renders are
	// silently dropped, and an empty submission would burn an attempt.
	await page.waitForLoadState('networkidle');

	// The event-page check must anchor at the END of the path: the fill route
	// (/events/…/<slug>/questionnaire/<id>) CONTAINS the event slug.
	const eventPageUrl = new RegExp(`/${eventSlug}(?:\\?|$)`);
	const radio = page.getByRole('radio', { name: answer });
	const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
	await expect(async () => {
		if (eventPageUrl.test(page.url())) return; // already back on the event
		await radio.check();
		await expect(radio).toBeChecked();
		await expect(submit).toBeEnabled();
		await submit.click();
		await page.waitForURL(eventPageUrl, { timeout: 8_000 });
	}).toPass({ timeout: 40_000 });
}

/** Reload the event page until the (async-evaluated) gate shows `text`. */
async function reloadUntilGateShows(
	page: import('@playwright/test').Page,
	path: string,
	text: string
): Promise<void> {
	await expect(async () => {
		await gotoHydrated(page, path);
		await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible({
			timeout: 3_000
		});
	}).toPass({ timeout: 30_000 });
}

test.describe('J11 questionnaire retake @p2', () => {
	test('rejected with cooldown → retry countdown on the gate, retake locked', async ({
		browser
	}) => {
		const event = await arrangeGatedEvent({ maxAttempts: 3, cooldownSeconds: 7200 });
		const page = await openEventAs(browser, 'RetakeCooldown', event.path);

		await submitAnswer(page, event.slug, WRONG);
		await reloadUntilGateShows(page, event.path, 'Questionnaire not passed');

		await expect(
			page
				.getByText("Your questionnaire didn't meet the requirements. You can try again.")
				.filter({ visible: true })
				.first()
		).toBeVisible();
		// retry_on is set → countdown renders and the action stays disabled.
		await expect(
			page
				.getByText(/Available (on|in|soon|now)/)
				.filter({ visible: true })
				.first()
		).toBeVisible();
		const retryButton = page
			.getByRole('button', { name: 'Retry Available Soon' })
			.filter({ visible: true })
			.first();
		await expect(retryButton).toBeVisible();
		await expect(retryButton).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Complete Questionnaire' })).toBeHidden();

		await page.context().close();
	});

	test('attempts exhausted → failed gate with no action offered', async ({ browser }) => {
		const event = await arrangeGatedEvent({ maxAttempts: 1 });
		const page = await openEventAs(browser, 'RetakeExhausted', event.path);

		await submitAnswer(page, event.slug, WRONG);
		await reloadUntilGateShows(page, event.path, 'Questionnaire not passed');

		// \s+: the count and the label are separate template chunks (raw
		// newline + indentation between them — regexes skip whitespace folding).
		await expect(
			page
				.getByText(/1\s+questionnaire failed/)
				.filter({ visible: true })
				.first()
		).toBeVisible();
		// The essential distinction vs the cooldown state: NO next step at all.
		await expect(page.getByRole('button', { name: 'Complete Questionnaire' })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Retry Available Soon' })).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeHidden();

		await page.context().close();
	});

	test('attempts remaining without cooldown → gate re-arms and a correct retake unlocks', async ({
		browser
	}) => {
		const event = await arrangeGatedEvent({ maxAttempts: 2 });
		const page = await openEventAs(browser, 'RetakeSecondTry', event.path);

		await submitAnswer(page, event.slug, WRONG);
		// No cooldown + one attempt left → the gate immediately re-offers the
		// questionnaire ("Questionnaire required", not the failed dead-end).
		await reloadUntilGateShows(page, event.path, 'Questionnaire required');
		await expect(
			page.getByRole('button', { name: 'Complete Questionnaire' }).filter({ visible: true }).first()
		).toBeVisible();

		await submitAnswer(page, event.slug, CORRECT);
		// Approved → the RSVP card takes over from the gate.
		await expect(async () => {
			await gotoHydrated(page, event.path);
			await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
				timeout: 3_000
			});
		}).toPass({ timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Complete Questionnaire' })).toBeHidden();

		await page.context().close();
	});
});
