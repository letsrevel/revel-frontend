import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11.3–11.4 (USER_JOURNEYS.md) — fill an ADMISSION questionnaire with
// AUTOMATIC evaluation (inline Celery + MOCK LLM): the seeded FutureStack
// "Code of Conduct Agreement" (single fatal MCQ, min score 100).
//
// Each path uses its own THROWAWAY user: submissions are per-user state that
// would make seeded personas single-shot.

const EVENT_PATH = '/events/tech-innovators-network/futurestack-2025';
const CORRECT = 'Yes, I agree to the Code of Conduct';
const WRONG = 'No, I do not agree';

async function openQuestionnaire(
	browser: import('@playwright/test').Browser,
	label: string
): Promise<import('@playwright/test').Page> {
	const user = await createVerifiedUser(label);
	const context = await browser.newContext();
	await authenticateContext(context, user);
	const page = await context.newPage();
	await gotoHydrated(page, EVENT_PATH);
	await waitForClientAuth(page);

	// The admission gate blocks ticket purchase until the questionnaire passes.
	// (Ticketed events render the gate as text + CTA, not a headline.)
	// (Rendered twice — desktop and mobile layouts — so filter to the visible one.)
	await expect(
		page
			.getByText(/Complete the required questionnaire/)
			.filter({ visible: true })
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Complete Questionnaire' })
		.filter({ visible: true })
		.first()
		.click();
	await page.waitForURL(/\/questionnaire\//);
	// Let the questionnaire queries settle: a check() during the settling
	// re-renders is silently dropped, and an empty submission BURNS AN ATTEMPT
	// (accepted with score 0 → rejected).
	await page.waitForLoadState('networkidle');
	return page;
}

test.describe('J11 questionnaire fill & auto-evaluation @p1', () => {
	test('passing submission is auto-approved and unlocks the event', async ({ browser }) => {
		const page = await openQuestionnaire(browser, 'QuestPass');

		// The answer state can lag the freshly-mounted form (a too-early check
		// submits empty answers) — retry the select+submit loop until the app
		// accepts it and returns to the event.
		await expect(async () => {
			await page.getByRole('radio', { name: CORRECT }).check();
			await expect(page.getByRole('radio', { name: CORRECT })).toBeChecked();
			await page.getByRole('button', { name: 'Submit Questionnaire' }).click();
			await page.waitForURL(/futurestack-2025/, { timeout: 8_000 });
		}).toPass({ timeout: 40_000 });

		// Auto-evaluation completes just after the redirect renders, so reload
		// until the eligibility reflects the approval: gate gone, ticket CTA on.
		await expect(async () => {
			await gotoHydrated(page, EVENT_PATH);
			await expect(
				page
					.getByRole('button', { name: 'Get Tickets', exact: true })
					.filter({ visible: true })
					.first()
			).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Complete Questionnaire' })).toBeHidden();

		await page.context().close();
	});

	test('failing submission is auto-rejected and the gate reflects it', async ({ browser }) => {
		const page = await openQuestionnaire(browser, 'QuestFail');

		await expect(async () => {
			await page.getByRole('radio', { name: WRONG }).check();
			await expect(page.getByRole('radio', { name: WRONG })).toBeChecked();
			await page.getByRole('button', { name: 'Submit Questionnaire' }).click();
			await page.waitForURL(/futurestack-2025/, { timeout: 8_000 });
		}).toPass({ timeout: 40_000 });

		// Auto-evaluation rejects (fatal question answered wrong). The essential
		// property: the ticket CTA stays withheld — true both while the
		// evaluation is briefly pending AND once rejected (the gate then re-arms
		// for a retake, since this questionnaire allows attempts).
		await gotoHydrated(page, EVENT_PATH);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Get Tickets', exact: true }).filter({ visible: true })
		).toBeHidden();

		await page.context().close();
	});
});
