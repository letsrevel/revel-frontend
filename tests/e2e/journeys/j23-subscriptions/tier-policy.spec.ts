import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createMembershipQuestionnaire,
	createOrganization,
	setOrgMembershipPolicy
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — the TIER half of the membership-eligibility policy
// (FE PR④ / BE #777): each membership tier can override the organization's
// default questionnaire and its manual-approval default, edited in the Tiers
// tab's "Edit Membership Tier" dialog.
//
// Both overrides are TRI-STATE in the wire schema — `null` means "inherit",
// which the backend keeps distinct from an explicit `false`. The form collapses
// that onto a native <select> (`inherit` | `require` | `norequire`), so what
// these tests pin is that the distinction survives the whole loop: select →
// PUT → retrieve → repopulated select. A `false` that silently degraded to
// `null` would still LOOK saved (the option would just read "Inherit …"), which
// is exactly why the reopened control is asserted by option label as well as by
// value.
//
// The pipeline consequence of those flags (a tier-level `true` gating an apply
// to PENDING on a no-approval org) is covered end-to-end in j27; here it is the
// FORM round-trip only.
//
// Throwaway org per test so tier state never collides across parallel projects
// or re-runs.

const EDIT_DIALOG = 'Edit Membership Tier';
/** Every new org is created with this tier by a post-save signal. */
const DEFAULT_TIER = 'General membership';

/** Load the members page and switch to the Tiers tab. */
async function openTiersTab(page: Page, slug: string): Promise<void> {
	await gotoHydrated(page, `/org/${slug}/admin/members`);
	await waitForClientAuth(page);
	await page.getByRole('tab', { name: /^Tiers/ }).click();
}

/** Reload the members page and reopen the default tier's edit dialog. */
async function reopenTierForm(page: Page, slug: string): Promise<Locator> {
	await openTiersTab(page, slug);
	await page.getByRole('button', { name: `Edit ${DEFAULT_TIER}` }).click();
	const dialog = page.getByRole('dialog', { name: EDIT_DIALOG });
	await expect(dialog).toBeVisible({ timeout: 15_000 });
	return dialog;
}

/**
 * The label text of a <select>'s currently selected option. Asserting the
 * VALUE proves what will be posted; asserting the LABEL proves what the admin
 * actually reads back — the two only differ when the tri-state collapses.
 */
function selectedOption(dialog: Locator, selectId: string): Locator {
	return dialog.locator(`${selectId} option:checked`);
}

/** A specific option of a <select>, whose label may vary with org state. */
function option(dialog: Locator, selectId: string, value: string): Locator {
	return dialog.locator(`${selectId} option[value="${value}"]`);
}

test.describe('J23 tier eligibility overrides @p2', () => {
	test('questionnaire and approval overrides round-trip; "no approval" persists as an explicit choice', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const org = await createOrganization();
		// The picker's options come from the members page's questionnaire query,
		// so this has to exist before the first load.
		const questionnaire = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'automatic'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		let dialog = await reopenTierForm(page, org.slug);

		// A fresh tier overrides nothing: both selects sit on their inherit sentinel.
		await expect(dialog.locator('#tier-questionnaire')).toHaveValue('');
		await expect(selectedOption(dialog, '#tier-questionnaire')).toHaveText(
			'Inherit organization default'
		);
		await expect(dialog.locator('#tier-approval')).toHaveValue('inherit');

		await dialog.locator('#tier-questionnaire').selectOption(questionnaire.id);
		await dialog.locator('#tier-approval').selectOption('require');
		await dialog.getByRole('button', { name: 'Update Tier' }).click();
		await expect(dialog).toBeHidden({ timeout: 15_000 });

		// Reload, not just reopen: this has to be server state, not the form's
		// own leftover $state.
		dialog = await reopenTierForm(page, org.slug);
		await expect(dialog.locator('#tier-questionnaire')).toHaveValue(questionnaire.id);
		await expect(dialog.locator('#tier-approval')).toHaveValue('require');
		await expect(selectedOption(dialog, '#tier-approval')).toHaveText('Require approval');

		// The tri-state's sharp edge: switch to an explicit "don't require". If
		// that were stored as `null` instead of `false`, the reopened select would
		// fall back to the inherit sentinel.
		await dialog.locator('#tier-approval').selectOption('norequire');
		await dialog.getByRole('button', { name: 'Update Tier' }).click();
		await expect(dialog).toBeHidden({ timeout: 15_000 });

		dialog = await reopenTierForm(page, org.slug);
		await expect(dialog.locator('#tier-approval')).toHaveValue('norequire');
		await expect(selectedOption(dialog, '#tier-approval')).toHaveText("Don't require approval");
		// …and the untouched questionnaire override rode along unchanged.
		await expect(dialog.locator('#tier-questionnaire')).toHaveValue(questionnaire.id);

		await context.close();
	});

	test('the inherit option spells out the organization default it resolves to', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const org = await createOrganization();
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		let dialog = await reopenTierForm(page, org.slug);
		await expect(dialog.locator('#tier-approval')).toHaveValue('inherit');
		await expect(option(dialog, '#tier-approval', 'inherit')).toHaveText(
			'Inherit organization default (approval required)'
		);
		// bits-ui dialogs close on Escape; leaving it open would block the reload.
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden({ timeout: 15_000 });

		// Flip the ORG default (the tier itself is untouched) — the label follows.
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: false });
		dialog = await reopenTierForm(page, org.slug);
		await expect(dialog.locator('#tier-approval')).toHaveValue('inherit');
		await expect(option(dialog, '#tier-approval', 'inherit')).toHaveText(
			'Inherit organization default (no approval required)'
		);

		await context.close();
	});
});
