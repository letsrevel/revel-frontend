import { test, expect } from '../../support/fixtures';
import {
	attachQuestionnaire,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { getBackendUrl } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11 (USER_JOURNEYS.md) — questionnaire duplicate + submissions export.
// Duplicating deep-copies sections/questions/options but never submissions,
// always lands as an UNATTACHED DRAFT, and (like the poll clone) navigates to
// the copy with no toast. The export is an async XLSX (not CSV) behind a
// 202 + /api/exports/{id} poll; the spec observes the app's own traffic and
// fetches the signed download_url at the network layer.
//
// Isolation: throwaway org (duplicates pile onto the SAME org's admin index —
// exactly the pollution class that once knocked the seeded wine-tasting card
// off Org Alpha's page) + throwaway submitter. The backend export throttle is
// 1/min PER USER, and each project's run owns a fresh org owner, so parallel
// projects never contend.

const QUESTION = 'Do you agree to the house rules?';
const CORRECT = 'Yes, I agree to the rules';

test.describe('J11 questionnaire duplicate & export @p3', () => {
	test('duplicate lands as draft copy; export delivers the submissions XLSX', async ({
		browser
	}) => {
		test.setTimeout(240_000);

		const org = await createOrganization();
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});
		const questionnaire = await attachQuestionnaire(
			event,
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
							{ option: 'No, I do not agree', order: 1 }
						]
					}
				]
			},
			org.owner
		);

		// One real submission through the UI so the export has content.
		const submitter = await createVerifiedUser('Exported');
		const submitterContext = await browser.newContext();
		await authenticateContext(submitterContext, submitter);
		const submitterPage = await submitterContext.newPage();
		await gotoHydrated(submitterPage, event.path);
		await waitForClientAuth(submitterPage);
		await submitterPage
			.getByRole('button', { name: 'Complete Questionnaire' })
			.filter({ visible: true })
			.first()
			.click();
		await submitterPage.waitForURL(/\/questionnaire\//);
		await submitterPage.waitForLoadState('networkidle');
		const radio = submitterPage.getByRole('radio', { name: CORRECT });
		const submit = submitterPage.getByRole('button', { name: 'Submit Questionnaire' });
		const eventPageUrl = new RegExp(`/${event.slug}(?:\\?|$)`);
		await expect(async () => {
			if (eventPageUrl.test(submitterPage.url())) return;
			await radio.check();
			await expect(radio).toBeChecked();
			await expect(submit).toBeEnabled();
			await submit.click();
			await submitterPage.waitForURL(eventPageUrl, { timeout: 8_000 });
		}).toPass({ timeout: 40_000 });
		await submitterContext.close();

		// Owner: duplicate from the questionnaire card on the admin index.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const page = await ownerContext.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires`);
		await waitForClientAuth(page);
		const card = page
			.locator('article, li, div')
			.filter({ hasText: questionnaire.name })
			.filter({ has: page.getByRole('button', { name: 'Duplicate' }) })
			.last();
		await expect(card).toBeVisible({ timeout: 15_000 });
		await card.getByRole('button', { name: 'Duplicate' }).click();

		const modal = page.getByRole('dialog', { name: 'Duplicate Questionnaire' });
		await expect(modal).toBeVisible();
		const cloneName = `Copy of ${questionnaire.name}`;
		await expect(modal.getByLabel('New Questionnaire Name')).toHaveValue(cloneName);
		// Success = navigation to the copy's edit page (no toast), a different id.
		await modal.getByRole('button', { name: 'Duplicate', exact: true }).click();
		await page.waitForURL(
			(url) =>
				/\/admin\/questionnaires\/[0-9a-f-]{36}$/.test(url.pathname) &&
				!url.pathname.includes(questionnaire.id),
			{ timeout: 20_000 }
		);
		await expect(page.getByText(cloneName).first()).toBeVisible({ timeout: 15_000 });

		// Back on the index the copy sits next to the original as a Draft.
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires`);
		const cloneCard = page
			.locator('article, li, div')
			.filter({ hasText: cloneName })
			.filter({ hasText: /Draft/ })
			.filter({ has: page.getByRole('button', { name: 'Duplicate' }) })
			.last();
		await expect(cloneCard).toBeVisible({ timeout: 15_000 });

		// Export the ORIGINAL's submissions from its summary page: capture the
		// 202'd export id, let the app's poll surface the signed download_url,
		// then fetch the XLSX directly.
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires/${questionnaire.id}/summary`);
		await waitForClientAuth(page);
		const exportCreated = page.waitForResponse(
			(r) =>
				/\/submissions\/export/.test(r.url()) &&
				r.request().method() === 'POST' &&
				r.status() < 300,
			{ timeout: 30_000 }
		);
		await page.getByRole('button', { name: 'Export Submissions' }).click();
		const exported = (await (await exportCreated).json()) as {
			id: string;
			download_url: string | null;
		};

		let downloadUrl = exported.download_url;
		if (!downloadUrl) {
			const readyPoll = await page.waitForResponse(
				async (r) => {
					if (!new RegExp(`/api/exports/${exported.id}`).test(r.url()) || !r.ok()) return false;
					const body = (await r.json().catch(() => null)) as {
						download_url?: string | null;
					} | null;
					return !!body?.download_url;
				},
				{ timeout: 130_000 }
			);
			downloadUrl = ((await readyPoll.json()) as { download_url: string }).download_url;
		}
		await expect(
			page.getByText('Export ready! Your download should start automatically.')
		).toBeVisible({ timeout: 130_000 });

		const xlsx = await page.request.get(getBackendUrl(downloadUrl));
		expect(xlsx.status()).toBe(200);
		expect(xlsx.headers()['content-type'] ?? '').toMatch(/spreadsheet|excel|octet-stream/);

		await ownerContext.close();
	});
});
