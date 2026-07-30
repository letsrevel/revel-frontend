import type { Locator } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, createOrgQuestionnaire, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// Both membership pickers are NATIVE <select>s (unlike the questionnaire type
// picker, which is a bits-ui listbox). Their <option>s are attached but never
// "visible", so assert on the DOM rather than on visibility, and read the
// selection back through the select's value rather than a `selected` attribute
// — Svelte binds the value and emits no such attribute.
function optionIn(select: Locator, label: string): Locator {
	return select.locator('option').filter({ hasText: label });
}

async function expectSelectedOptionLabel(select: Locator, label: string): Promise<void> {
	const value = await select.inputValue();
	expect(value).not.toBe('');
	await expect(select.locator(`option[value="${value}"]`)).toHaveText(label);
}

// J11.1 (USER_JOURNEYS.md, "Create Questionnaire (Organizer)") — the MEMBERSHIP
// variant, authored through the admin UI, plus the two org-admin pickers that
// consume it. What it produces is the gate the J27 journey then walks.
//
// Why this spec exists: the whole membership-application journey was already
// covered by j27-applications, but every one of those specs arranges its
// questionnaire through the `createMembershipQuestionnaire` API factory. The
// admin UI's own type <Select> had `membership` hard-disabled behind a "Coming
// soon" badge since #337 — and on the CREATE form a second gate in
// `onValueChange` swallowed the value even if the item were clickable. Both
// gates outlived the backend feature by a long way, with a fully green E2E
// suite, precisely because nothing here drove the authoring UI. So this spec
// covers the seam the factory skips over, in both directions:
//
//   1. CREATE form (QuestionnaireCreateBasicInfo) — build one from scratch.
//   2. EDIT form (QuestionnaireFormFields) — retype an existing admission one.
//
// The payoff assertion in both is the same and is deliberately NOT a read-back
// of the type <Select>: it is the questionnaire appearing in the org-settings
// default-questionnaire picker, which the server filters to
// `questionnaire_type === 'membership'` (settings/+page.server.ts). If it shows
// up there, the type genuinely round-tripped through the API — a trigger label
// would only prove local component state.
//
// Isolation: a throwaway org per test, so the org-wide default questionnaire
// and tier overrides written here never leak into another spec's org.

test.describe('J11 membership questionnaire type @p2', () => {
	test('an organizer builds a membership questionnaire and both pickers offer it', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization({ acceptMembershipRequests: true });

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		// ---- Before: the org has no membership questionnaire, and the settings
		// picker says so. This is the empty state the disabled option stranded
		// organizers in — its "manage questionnaires" link led to the very form
		// where the type could not be chosen.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByText('No membership questionnaires yet.')).toBeVisible({
			timeout: 15_000
		});

		// ---- Build. Defaults are Admission type + Manual evaluation, so the type
		// is the only field that has to move.
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires/new`);
		await waitForClientAuth(page);
		const qName = uniqueName('Join Screening');
		await page.getByLabel('Questionnaire Name').fill(qName);

		// The regression, twice over: the option has to be ENABLED to be clicked
		// at all, and `onValueChange` has to accept 'membership' for the click to
		// stick. A no-op leaves the trigger reading "Admission", so asserting the
		// trigger here separates a swallowed value from a disabled item.
		const typeTrigger = page.locator('#type');
		await expect(typeTrigger).toHaveText(/Admission/);
		await pickSelectOption(page, typeTrigger, 'Membership');
		await expect(typeTrigger).toHaveText(/Membership/);

		// One mandatory free-text question — manual evaluation, so nothing here
		// needs a grader (and free text under automatic grading is refused
		// outright: it would want LLM guidelines).
		const FT_TEXT = 'Why do you want to join?';
		await page.getByRole('button', { name: 'Free Text' }).first().click();
		const ftEditor = page.getByRole('textbox', { name: 'Question Text (Markdown)' }).first();
		await ftEditor.fill(FT_TEXT);

		// A freshly-mounted Tiptap editor can silently drop a fill() while it
		// settles, which blocks the save with "All questions must have text" and no
		// navigation — re-fill what got lost, keyed on the redirect (same trap as
		// builder.spec.ts).
		await expect(async () => {
			if (!(await ftEditor.innerText()).includes(FT_TEXT)) {
				await ftEditor.fill(FT_TEXT);
			}
			await page.getByRole('button', { name: 'Save Questionnaire' }).click();
			await page.waitForURL(/\/admin\/questionnaires\/(?!new)[0-9a-f-]+$/, { timeout: 8_000 });
		}).toPass({ timeout: 60_000 });
		await expect(page.getByText(qName).first()).toBeVisible();

		// ---- Publish (status changes fire a native confirm()).
		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

		// ---- Picker 1: the org-wide default. Selecting and SAVING it is the part
		// that proves the backend agrees about the type — `default_membership_
		// questionnaire` both limits choices to membership wrappers and re-checks
		// the type on clean, so a mistyped wrapper would come back 4xx here.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByText('No membership questionnaires yet.')).toBeHidden();
		const defaultPicker = page.locator('#default_membership_questionnaire_id');
		await expect(optionIn(defaultPicker, qName)).toBeAttached();
		await defaultPicker.selectOption({ label: qName });
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(
			page.getByText('Your organization settings have been updated successfully.')
		).toBeVisible({ timeout: 15_000 });

		// Reload rather than trusting the in-page state: the picker is seeded from
		// the load function, so a surviving selection after a fresh SSR read is the
		// persistence proof — and it proves the BACKEND accepted the wrapper, which
		// it only does for a membership-typed one.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expectSelectedOptionLabel(page.locator('#default_membership_questionnaire_id'), qName);

		// ---- Picker 2: the per-tier override, which reads the same filtered list.
		await gotoHydrated(page, `/org/${org.slug}/admin/members?tab=tiers`);
		await waitForClientAuth(page);
		// The tier cards arrive on a client query, so wait the row out before
		// clicking its icon-only edit button (named solely by aria-label).
		const editTier = page.getByRole('button', { name: 'Edit General membership' });
		await expect(editTier).toBeVisible({ timeout: 20_000 });
		await editTier.click();
		const tierDialog = page.getByRole('dialog', { name: 'Edit Membership Tier' });
		await expect(tierDialog).toBeVisible({ timeout: 15_000 });
		const tierPicker = tierDialog.locator('#tier-questionnaire');
		await expect(optionIn(tierPicker, qName)).toBeAttached();
		// The override is genuinely settable, not merely listed.
		await tierPicker.selectOption({ label: qName });
		await expectSelectedOptionLabel(tierPicker, qName);

		await context.close();
	});

	test('an existing admission questionnaire can be retyped to membership', async ({ browser }) => {
		test.setTimeout(180_000);
		const org = await createOrganization({ acceptMembershipRequests: true });
		// Arrange via API — this test is about the EDIT form, not the builder.
		const questionnaire = await createOrgQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'manual',
			questionnaireType: 'admission'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		// An admission questionnaire is invisible to the membership picker.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByText('No membership questionnaires yet.')).toBeVisible({
			timeout: 15_000
		});

		// ---- Retype. The edit page lands in READ-ONLY mode (`isEditMode` starts
		// false and gates `canEdit`), so the type <Select> is disabled until the
		// "Edit Questionnaire" button flips it — clicking the trigger first would
		// silently do nothing.
		await gotoHydrated(page, `/org/${org.slug}/admin/questionnaires/${questionnaire.id}`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Edit Questionnaire' }).click();

		const typeTrigger = page.locator('#type');
		await expect(typeTrigger).toHaveText(/Admission/);
		await pickSelectOption(page, typeTrigger, 'Membership');
		await expect(typeTrigger).toHaveText(/Membership/);
		await page.getByRole('button', { name: 'Save Changes' }).first().click();

		// ---- And now it is a membership questionnaire everywhere that matters.
		await expect(async () => {
			await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
			await waitForClientAuth(page);
			await expect(
				optionIn(page.locator('#default_membership_questionnaire_id'), questionnaire.name)
			).toBeAttached({ timeout: 10_000 });
		}).toPass({ timeout: 45_000 });
		await expect(page.getByText('No membership questionnaires yet.')).toBeHidden();

		await context.close();
	});
});
