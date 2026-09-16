import { test, expect } from '../../support/fixtures';
import { revealRegistrationForm } from '../../support/auth-forms';
import { gotoHydrated } from '../../support/navigation';

// J2 (USER_JOURNEYS.md) — registering from a referral-program invite link
// (FE #938, BE #987): `?referral_invite=<application_id>` resolves
// server-side to the invited email, locks the email field to it, and shows
// an invite banner. Anything that doesn't resolve (garbage id, well-formed
// but unknown id) degrades SILENTLY to the ordinary form.

const VALID_INVITE_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
const INVITED_EMAIL = 'test.invitee@example.com';
const INVITED_CODE = 'invitee-code';
const UNKNOWN_INVITE_ID = 'ffffffff-1111-4111-8111-111111111111';
const PASSWORD = 'E2e-test-Pass!123';
const BANNER = "You've been invited to the referral program";

// These need no fixture at all, so they run on every journey project.
test.describe('J02 referral-invite registration: fallbacks @p2', () => {
	test('a malformed invite id falls back to the ordinary form', async ({ page }) => {
		await gotoHydrated(page, '/register?referral_invite=not-a-uuid');
		await revealRegistrationForm(page);

		await expect(page.getByText(BANNER)).toHaveCount(0);

		const emailInput = page.getByLabel('Email address');
		await expect(emailInput).toHaveValue('');
		await expect(emailInput).toHaveJSProperty('readOnly', false);
	});

	test('a well-formed but unknown invite id falls back to the ordinary form', async ({ page }) => {
		await gotoHydrated(page, `/register?referral_invite=${UNKNOWN_INVITE_ID}`);
		await revealRegistrationForm(page);

		await expect(page.getByText(BANNER)).toHaveCount(0);

		const emailInput = page.getByLabel('Email address');
		await expect(emailInput).toHaveValue('');
		await expect(emailInput).toHaveJSProperty('readOnly', false);
	});
});

/*
 * The seeded invite is a SINGLE-USE fixture: `GET /referral/invitations/{id}`
 * only answers for an APPROVED application with no user attached, and the
 * second test here registers through it, which attaches one. Two constraints
 * follow, and both are enforced below:
 *
 *  - order matters, hence `.serial` — `fullyParallel` would otherwise be free
 *    to run the consuming test first and leave the banner test looking at a
 *    404;
 *  - only ONE project may touch it. Journey specs run on `chromium` and
 *    `mobile-chrome`, `.serial` orders within a project but says nothing
 *    across them, so without this pin the two projects race for the same row
 *    (which is exactly how this file first went flaky). Pinned rather than
 *    dropped: the invite→register→enrolled path is the whole point of the
 *    feature. If it is ever worth running on mobile too, the fix is a second
 *    seeded invite id in `bootstrap_test_events`, not more retries here.
 *
 * Re-running needs a freshly seeded DB (`make e2e-setup`). `reset_events`
 * deletes @example.com users, which cascades the attachment away, so a
 * reseed genuinely restores the fixture.
 */
test.describe.serial('J02 referral-invite registration: seeded invite @p2', () => {
	test.beforeEach(async () => {
		test.skip(
			test.info().project.name !== 'chromium',
			'single-use seeded invite — one project only, see the comment above'
		);
	});

	test('a valid invite shows the banner and locks the email field', async ({ page }) => {
		await gotoHydrated(page, `/register?referral_invite=${VALID_INVITE_ID}`);
		await revealRegistrationForm(page);

		await expect(page.getByText(BANNER)).toBeVisible();
		// The code is interpolated inside a sentence, not its own text node —
		// a substring match, not `getByText(..., { exact: true })`.
		await expect(page.getByText(INVITED_CODE)).toBeVisible();

		const emailInput = page.getByLabel('Email address');
		await expect(emailInput).toHaveValue(INVITED_EMAIL);
		await expect(emailInput).toHaveJSProperty('readOnly', true);
	});

	// CONSUMES the invite — must stay last in this serial block.
	test('completes registration through the invite', async ({ page }) => {
		await gotoHydrated(page, `/register?referral_invite=${VALID_INVITE_ID}`);
		await revealRegistrationForm(page);

		const emailInput = page.getByLabel('Email address');
		await expect(emailInput).toHaveValue(INVITED_EMAIL);

		const passwordInput = page.getByLabel('Password', { exact: true });
		const confirmInput = page.getByLabel('Confirm password');
		const terms = page.getByLabel(/I accept the/);
		const submit = page.getByRole('button', { name: 'Create your account' });

		// Outcome-keyed re-fill (same medicine as the plain registration specs):
		// a fill landing in the hydration-settling window can update the DOM
		// without Svelte's $state ever learning about it, so retry until the
		// submit button actually enables.
		await expect(async () => {
			await passwordInput.fill(PASSWORD);
			await confirmInput.fill(PASSWORD);
			if (!(await terms.isChecked())) await terms.check();
			await expect(passwordInput).toHaveValue(PASSWORD, { timeout: 2_000 });
			await expect(submit).toBeEnabled({ timeout: 2_000 });
		}).toPass({ timeout: 45_000 });

		await submit.click();
		await page.waitForURL(/\/register\/check-email/);
	});
});
