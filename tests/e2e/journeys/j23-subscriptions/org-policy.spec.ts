import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createMembershipQuestionnaire, createOrganization } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — the "org policy fields" half of the plans-admin row:
// membership_grace_period_days + membership_refund_policy, edited on the org
// admin Settings page (they ride the same PUT /api/organization-admin/{slug} as
// revenue_report_cadence).
//
// Built out once FE #631 / BE #695 landed the editing UI + writable schema.
// Because OrganizationEditSchema gives BOTH fields defaults (7 / ""), any PUT
// that omits them silently resets them — the telegram_url data-loss class from
// #491. The second test is that regression guard: editing an UNRELATED field
// must not wipe the policy.
//
// Throwaway org per test so state never collides across parallel projects/re-runs.

const SAVED = 'Your organization settings have been updated successfully.';

/** The Settings-page section that holds the two subscription-policy fields. */
function policySection(page: Page): Locator {
	return page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Subscription policy' }) });
}

/**
 * Fill a Tiptap (contenteditable) editor and confirm the text landed. Tiptap
 * can drop the first programmatic fill before it has finished mounting, so we
 * re-fill until the content sticks (the pr-607 outcome-keyed pattern).
 */
async function fillEditor(editor: Locator, text: string): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt++) {
		await editor.fill(text);
		try {
			await expect(editor).toContainText(text, { timeout: 2_000 });
			return;
		} catch {
			// Fill dropped before mount — try again.
		}
	}
	await expect(editor).toContainText(text);
}

test.describe('J23 org subscription policy fields @p2', () => {
	test('edits grace period and refund policy via the UI; both persist across reload', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Organization Settings' })).toBeVisible();

		const graceInput = page.locator('#membership_grace_period_days');
		const refundEditor = policySection(page).locator('[contenteditable="true"]');

		// A fresh org carries the backend defaults.
		await expect(graceInput).toHaveValue('7');

		const refundText = `E2E refund terms ${org.slug}`;
		await graceInput.fill('21');
		await fillEditor(refundEditor, refundText);

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText(SAVED)).toBeVisible({ timeout: 15_000 });

		// Server-side persistence: a fresh load renders the saved values.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.locator('#membership_grace_period_days')).toHaveValue('21');
		await expect(policySection(page).locator('[contenteditable="true"]')).toContainText(refundText);

		await context.close();
	});

	test('saving an unrelated field does not reset the subscription policy (regression #491/#631)', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);

		// Set a NON-default policy first, through the UI.
		const refundText = `E2E keep-me ${org.slug}`;
		await page.locator('#membership_grace_period_days').fill('30');
		await fillEditor(policySection(page).locator('[contenteditable="true"]'), refundText);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText(SAVED)).toBeVisible({ timeout: 15_000 });

		// Now edit ONLY an unrelated field (address) and save again. If the form
		// dropped the policy fields, the backend defaults (7 / "") would silently
		// overwrite them on this second PUT.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		const newAddress = `E2E Address ${org.slug}`;
		await page.locator('#address').fill(newAddress);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText(SAVED)).toBeVisible({ timeout: 15_000 });

		// Reload: the unrelated edit stuck AND the policy is untouched.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.locator('#address')).toHaveValue(newAddress);
		await expect(page.locator('#membership_grace_period_days')).toHaveValue('30');
		await expect(policySection(page).locator('[contenteditable="true"]')).toContainText(refundText);

		await context.close();
	});

	// The membership-eligibility defaults (BE #777) that landed alongside the
	// revival window: the tier form's "inherit" options resolve against these, so
	// they have to survive an ordinary Settings save unchanged. Every one of them
	// posts on EVERY save (the whole form is one POST), so this pins the
	// round-trip — form → PUT → retrieve → repopulated control — for the three
	// controls at once, then re-checks them after a save that touched only an
	// unrelated field.
	test('revival window, default questionnaire and approval default round-trip; an unrelated save keeps them', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		// Arranged BEFORE the first page load: the picker's options come from the
		// settings load function, so a questionnaire created later would not be
		// selectable without another reload.
		const org = await createOrganization();
		const questionnaire = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'automatic'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Organization Settings' })).toBeVisible();

		const revivalInput = page.getByLabel('Revival window (days)');
		const questionnairePicker = page.getByLabel('Default membership questionnaire');
		const approvalToggle = page.getByRole('checkbox', {
			name: 'Require manual approval for new members'
		});

		// Fresh-org defaults: 30-day revival, no questionnaire, no approval gate.
		await expect(revivalInput).toHaveValue('30');
		await expect(questionnairePicker).toHaveValue('');
		await expect(approvalToggle).not.toBeChecked();

		await revivalInput.fill('14');
		await questionnairePicker.selectOption(questionnaire.id);
		await approvalToggle.check();

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText(SAVED)).toBeVisible({ timeout: 15_000 });

		// Server-side persistence: a fresh load renders all three saved values.
		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Revival window (days)')).toHaveValue('14');
		await expect(page.getByLabel('Default membership questionnaire')).toHaveValue(questionnaire.id);
		await expect(
			page.getByRole('checkbox', { name: 'Require manual approval for new members' })
		).toBeChecked();

		// No-clobber: a save that only touched the address must leave the policy
		// exactly as it was. The failure this guards is FE-side (the #491 class) —
		// a control whose value is dropped or reset on its way back into the
		// payload would land the schema defaults (30 / none / off) here instead.
		const newAddress = `E2E Address ${org.slug}`;
		await page.locator('#address').fill(newAddress);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText(SAVED)).toBeVisible({ timeout: 15_000 });

		await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
		await waitForClientAuth(page);
		await expect(page.locator('#address')).toHaveValue(newAddress);
		await expect(page.getByLabel('Revival window (days)')).toHaveValue('14');
		await expect(page.getByLabel('Default membership questionnaire')).toHaveValue(questionnaire.id);
		await expect(
			page.getByRole('checkbox', { name: 'Require manual approval for new members' })
		).toBeChecked();

		await context.close();
	});
});
