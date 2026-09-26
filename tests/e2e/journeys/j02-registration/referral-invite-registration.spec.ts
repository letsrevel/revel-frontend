import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, fetchWithRetry } from '../../support/api';
import { revealRegistrationForm } from '../../support/auth-forms';
import { extractLink, waitForEmail, type MailpitMessage } from '../../support/mailpit';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J2.5 "Registration via Referral Invite Link" + J21.10 "Enrollment"
// (USER_JOURNEYS.md; FE #938, BE #987): `?referral_invite=<application_id>`
// resolves server-side to the invited email, locks the email field to it, and
// shows an invite banner. Anything that doesn't resolve (garbage id,
// well-formed but unknown id) degrades SILENTLY to the ordinary form. The
// full path — register, verify through the emailed link, land signed in —
// ends with the new account enrolled under the invite's code on
// /account/referral (enrollment is by email match at account creation).

const VALID_INVITE_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
const INVITED_EMAIL = 'test.invitee@example.com';
const INVITED_CODE = 'invitee-code';
const UNKNOWN_INVITE_ID = 'ffffffff-1111-4111-8111-111111111111';
const PASSWORD = 'E2e-test-Pass!123';
const INVITE_URL = `${API_URL}/api/referral/invitations/${VALID_INVITE_ID}`;
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
 * Re-running WITHOUT a reseed is handled by `reopenSeededInvite()` in
 * `beforeAll`: if a previous run consumed the invite, it deletes the account
 * that run created (GDPR delete-request → Mailpit token → delete-confirm).
 * `ReferralApplication.user` is SET_NULL and account deletion tears down the
 * `ReferralCode` (accounts/service/referral_cleanup.py), which is exactly the
 * seeded "approved, no user attached" state again. A reseed (`reset_events`
 * deletes @example.com users) restores it just the same. `--repeat-each`
 * needs `--workers=1` here: parallel copies would race for the same row.
 */

/**
 * Poll until an email sent at/after `since` arrives — the invitee's mailbox
 * accumulates one verification/deletion email per run, and `waitForEmail`
 * alone returns whichever match Mailpit lists first. The full-message payload
 * carries the `Date` header (second precision), not the summary's `Created`,
 * hence the slack callers subtract from `since`.
 */
async function waitForFreshEmail(
	query: { to: string; subject: string },
	since: number
): Promise<MailpitMessage> {
	let message: MailpitMessage | undefined;
	await expect(async () => {
		const candidate = await waitForEmail(query, 5_000);
		const sent = (candidate as MailpitMessage & { Date?: string }).Date;
		expect(Date.parse(sent ?? '')).toBeGreaterThanOrEqual(since);
		message = candidate;
	}).toPass({ timeout: 30_000 });
	if (!message) throw new Error(`No fresh "${query.subject}" email to ${query.to}`);
	return message;
}

async function inviteIsOpen(): Promise<boolean> {
	return (await fetchWithRetry(INVITE_URL)).status === 200;
}

async function reopenSeededInvite(): Promise<void> {
	if (await inviteIsOpen()) return;

	let api: ApiClient;
	try {
		api = await ApiClient.login(INVITED_EMAIL, PASSWORD);
	} catch (error) {
		throw new Error(
			`The seeded referral invite is consumed and ${INVITED_EMAIL} can't be signed in to ` +
				`release it (${String(error)}). Reseed the backend (make e2e-setup).`,
			{ cause: error }
		);
	}
	const since = Date.now() - 5_000;
	await api.post('/api/account/delete-request');
	const message = await waitForFreshEmail(
		{ to: INVITED_EMAIL, subject: 'Confirm Account Deletion' },
		since
	);
	const token = new URL(extractLink(message, /confirm-deletion\?token=/)).searchParams.get('token');
	const confirm = await fetchWithRetry(`${API_URL}/api/account/delete-confirm`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	expect(confirm.status, await confirm.text()).toBe(200);
	// Celery runs eagerly in the E2E stack, but poll rather than assume it.
	await expect.poll(inviteIsOpen, { timeout: 30_000 }).toBe(true);
}

test.describe.serial('J02 referral-invite registration: seeded invite @p2', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeAll(async ({}, testInfo) => {
		if (testInfo.project.name !== 'chromium') return;
		await reopenSeededInvite();
	});

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
	test('completes registration through the invite and is enrolled', async ({ page }) => {
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

		const since = Date.now() - 5_000;
		await submit.click();
		await page.waitForURL(/\/register\/check-email/);

		// Verify through the emailed link — it signs the new account in.
		const message = await waitForFreshEmail(
			{ to: INVITED_EMAIL, subject: 'Verify your email' },
			since
		);
		await page.goto(extractLink(message, /token=/));
		await page.waitForURL(/\/account\/profile/);

		// J21.10: enrolled at account creation under the invite's code, so the
		// referrer-only page renders it (non-referrers get bounced to /dashboard).
		await gotoHydrated(page, '/account/referral');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { level: 1, name: 'Referral Program' })).toBeVisible();
		await expect(page.getByText('Your referral code')).toBeVisible();
		await expect(page.getByText(INVITED_CODE, { exact: true })).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/account/referral');
	});
});
