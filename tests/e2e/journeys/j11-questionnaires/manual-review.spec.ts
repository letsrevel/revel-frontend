import { test, expect } from '../../support/fixtures';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11.5–11.6 (USER_JOURNEYS.md) — MANUAL review of the seeded wine-tasting
// admission questionnaire ("Wine Tasting Dinner Application", Org Alpha,
// evaluation_mode=manual, 10 seeded submissions).
//
// Re-runnability: the backend evaluates via update_or_create keyed on the
// submission, so approving is IDEMPOTENT — but it does mutate the seed until
// the next `make reset-events && make bootstrap`. The spec therefore finds
// its row through the default "All" filter (a pending-only filter would come
// up empty on the second run) and asserts only the post-state. Desktop and
// mobile projects review DIFFERENT seeded applicants so concurrently running
// projects never race on the same evaluation row.

const QUESTIONNAIRES_PATH = '/org/revel-events-collective/admin/questionnaires';
const EVENT_PATH = '/events/revel-events-collective/exclusive-wine-tasting-dinner';
const QUESTIONNAIRE_NAME = 'Wine Tasting Dinner Application';

test.describe('J11 questionnaire manual review @p1', () => {
	test('owner approves a submission with notes and the applicant is unblocked', async ({
		asOwner: page,
		isMobile,
		browser
	}) => {
		// Both start seeded as PENDING_REVIEW (jordan/sam); taylor/nina (no
		// evaluation row yet) stay untouched as manual-repro spares.
		const applicant = isMobile
			? { name: 'Sam Okafor', email: 'sam.wine@example.com' }
			: { name: 'Jordan Kim', email: 'jordan.wine@example.com' };

		// Index → wine questionnaire card → its Submissions list.
		await gotoHydrated(page, QUESTIONNAIRES_PATH);
		await waitForClientAuth(page);
		await page
			.locator('div.bg-card')
			.filter({ hasText: QUESTIONNAIRE_NAME })
			.getByRole('link', { name: 'Submissions' })
			.click();
		await page.waitForURL(/\/submissions$/);

		// The desktop table and mobile card list render in parallel — scope to
		// the visible container holding ONLY this applicant (the desktop table's
		// own wrapping Card matches div.bg-card too and holds every name, so
		// exclude anything that also contains another seeded respondent).
		await page
			.locator('tbody tr, div.bg-card')
			.filter({ hasText: applicant.name })
			.filter({ hasNot: page.getByText('Sophie Laurent', { exact: true }) })
			.filter({ visible: true })
			.getByRole('link', { name: 'Review' })
			.click();
		await expect(page.getByRole('heading', { name: 'Review Submission' })).toBeVisible();

		// Approve WITH notes: comments hide behind the Advanced Options
		// disclosure; the whole evaluation is one native form POST.
		await page.getByRole('button', { name: 'Advanced Options (Score & Comments)' }).click();
		await page
			.getByLabel('Comments (Optional)')
			.fill(`Great fit for the tasting — welcome! (e2e ${Date.now()})`);
		await page.getByRole('button', { name: 'Approve' }).click();

		// The evaluate action 303-redirects back to the same submission; the
		// approved state marks the Approve button as current.
		await expect(page.getByRole('button', { name: /Approve/ }).getByText('Current')).toBeVisible();

		// The applicant is unblocked: the admission gate clears and the ticket
		// CTA appears (the seeded event has open, purchasable tiers).
		const applicantContext = await browser.newContext();
		await authenticateContext(applicantContext, {
			email: applicant.email,
			password: 'password123'
		});
		const applicantPage = await applicantContext.newPage();
		await expect(async () => {
			await gotoHydrated(applicantPage, EVENT_PATH);
			await expect(
				applicantPage
					.getByRole('button', { name: 'Get Tickets', exact: true })
					.filter({ visible: true })
					.first()
			).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });
		await expect(applicantPage.getByText(/being reviewed|under review/i)).toBeHidden();

		await applicantContext.close();
	});

	test('submissions list shows seeded evaluation states and filters by status', async ({
		asOwner: page
	}) => {
		await gotoHydrated(page, QUESTIONNAIRES_PATH);
		await waitForClientAuth(page);
		await page
			.locator('div.bg-card')
			.filter({ hasText: QUESTIONNAIRE_NAME })
			.getByRole('link', { name: 'Submissions' })
			.click();
		await page.waitForURL(/\/submissions$/);

		const visibleName = (name: string) =>
			page.getByText(name, { exact: true }).filter({ visible: true }).first();

		// Default "All": every seeded submission fits on one page.
		await expect(page.getByText(/of 10 submissions/).first()).toBeVisible();
		await expect(visibleName('Sophie Laurent')).toBeVisible();

		// Approved: seeded approvals stay approved forever (the approve test
		// only ever ADDS to this set, so presence is run-order-proof); a seeded
		// rejection must not leak in.
		await page.getByRole('button', { name: 'Approved' }).click();
		await expect(page).toHaveURL(/evaluation_status=approved/);
		await expect(visibleName('Sophie Laurent')).toBeVisible();
		await expect(visibleName('Marco Bianchi')).toBeVisible();
		await expect(page.getByText('Elena Volkov', { exact: true })).toBeHidden();

		// Rejected: the two seeded rejections, and no approved name.
		await page.getByRole('button', { name: 'Rejected' }).click();
		await expect(page).toHaveURL(/evaluation_status=rejected/);
		await expect(visibleName('Elena Volkov')).toBeVisible();
		await expect(visibleName('Chris Park')).toBeVisible();
		await expect(page.getByText('Sophie Laurent', { exact: true })).toBeHidden();
	});
});
