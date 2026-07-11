import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J11.1–11.2 (USER_JOURNEYS.md) — the questionnaire BUILDER: an organizer
// creates an admission questionnaire (top-level MCQ with weights + a section
// holding a free-text question), publishes it, attaches it to an event, and
// the admission gate arms for an attendee.
//
// Everything lives in a THROWAWAY org + event: attaching an ADMISSION
// questionnaire to a seeded event would gate that event for every other spec,
// and an isolated org keeps the assignment modal down to exactly one row.

test.describe('J11 questionnaire builder @p1', () => {
	test('owner builds, publishes and attaches a questionnaire; the event gate arms', async ({
		browser
	}) => {
		// ---- Arrange via API: fresh org + open ticketed event with a free tier.
		const org = await createOrganization();
		const event = await createTicketedEvent({ owner: org.owner, orgSlug: org.slug });

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		// ---- Build. Defaults are already Admission type + Manual evaluation.
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires/new`);
		await waitForClientAuth(page);
		const qName = uniqueName('Screening');
		await page.getByLabel('Questionnaire Name').fill(qName);
		await page.getByLabel('Minimum Score (%)').fill('50');

		const MCQ_TEXT = 'Do you agree to the house rules?';
		const FT_TEXT = 'What draws you to this event?';

		// Top-level MCQ. First add-click happens in the empty state, where the
		// card header holds the only "Multiple Choice" button.
		await page.getByRole('button', { name: 'Multiple Choice' }).first().click();
		// Question text is a Tiptap contenteditable named by its linked label.
		const mcqEditor = page.getByRole('textbox', { name: 'Question Text (Markdown)' }).first();
		await mcqEditor.fill(MCQ_TEXT);
		await page.getByPlaceholder('Option 1').fill('Yes, I agree');
		await page.getByPlaceholder('Option 2').fill('No');
		// The correct-answer checkbox carries only a title attribute.
		await page.getByRole('checkbox', { name: 'Mark as correct answer' }).first().check();
		// Weights live behind the per-question Advanced Settings disclosure.
		await page.getByRole('button', { name: 'Advanced Settings' }).click();
		await page.getByLabel('Positive Weight').fill('5');
		await page.getByLabel('Negative Weight').fill('1');

		// Section with a free-text question inside. The SectionEditor card is the
		// dashed-border container; scope into it so the section's own add-question
		// buttons don't collide with the page-level ones.
		await page.getByRole('button', { name: 'Add Section' }).first().click();
		const section = page.locator('div.border-2.border-dashed');
		await section.getByPlaceholder('Section name...').fill('About you');
		await section.getByRole('button', { name: 'Free Text' }).click();
		const ftEditor = section.getByRole('textbox', { name: 'Question Text (Markdown)' });
		await ftEditor.fill(FT_TEXT);

		// A freshly-mounted Tiptap editor can silently drop a fill() while it
		// settles ("All questions must have text" then blocks the save with no
		// navigation) — re-fill anything that got lost, then save; keyed on the
		// redirect to the new questionnaire's edit page.
		await expect(async () => {
			for (const [editor, text] of [
				[mcqEditor, MCQ_TEXT],
				[ftEditor, FT_TEXT]
			] as const) {
				if (!(await editor.innerText()).includes(text)) {
					await editor.fill(text);
				}
			}
			await page.getByRole('button', { name: 'Save Questionnaire' }).click();
			await page.waitForURL(/\/admin\/questionnaires\/(?!new)[0-9a-f-]+$/, { timeout: 8_000 });
		}).toPass({ timeout: 60_000 });
		await expect(page.getByText(qName).first()).toBeVisible();
		// The created structure renders read-only on the edit page.
		await expect(page.getByText('Do you agree to the house rules?').first()).toBeVisible();
		await expect(page.getByText('What draws you to this event?').first()).toBeVisible();

		// ---- Publish (status changes fire a native confirm()).
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Publish' }).click();
		// Published state swaps the action set to Unpublish/Mark as Draft.
		await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

		// ---- Attach to the event from the event editor's Admission & Screening.
		await gotoHydrated(page, `/org/${org.slug}/admin/events/${event.id}/edit`);
		const admissionToggle = page.getByRole('button', { name: 'Admission & Screening' });
		await expect(admissionToggle).toBeVisible();
		if ((await admissionToggle.getAttribute('aria-expanded')) !== 'true') {
			await admissionToggle.click();
		}
		await page.getByRole('button', { name: 'Assign Questionnaires' }).click();
		const dialog = page.getByRole('dialog', { name: 'Assign Questionnaires to Event' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('checkbox', { name: `Select ${qName}` }).check();
		await dialog.getByRole('button', { name: 'Save Assignments' }).click();
		await expect(dialog).toBeHidden();
		// The assignment lands in the Required Questionnaires list (its remove
		// button is the row's unambiguous accessible handle).
		await expect(page.getByRole('button', { name: `Remove ${qName}` })).toBeVisible();

		await page.context().close();

		// ---- The gate arms: a fresh attendee sees the questionnaire prompt
		// instead of the ticket CTA (same gate copy fill-auto-eval consumes).
		const visitor = await createVerifiedUser('GateCheck');
		const visitorContext = await browser.newContext();
		await authenticateContext(visitorContext, visitor);
		const visitorPage = await visitorContext.newPage();
		await gotoHydrated(visitorPage, event.path);
		await waitForClientAuth(visitorPage);
		await expect(
			visitorPage
				.getByText(/Complete the required questionnaire/)
				.filter({ visible: true })
				.first()
		).toBeVisible();
		await expect(
			visitorPage
				.getByRole('button', { name: 'Complete Questionnaire' })
				.filter({ visible: true })
				.first()
		).toBeVisible();
		await expect(
			visitorPage
				.getByRole('button', { name: 'Get Tickets', exact: true })
				.filter({ visible: true })
		).toBeHidden();

		await visitorContext.close();
	});
});
