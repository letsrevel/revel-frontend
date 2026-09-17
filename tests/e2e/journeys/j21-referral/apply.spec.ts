import type { Page } from '@playwright/test';
import crypto from 'node:crypto';
import { test, expect } from '../../support/fixtures';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J21 (USER_JOURNEYS.md) — public referral-program application (FE #938,
// BE #987): a guest applies at /referral/apply (SSR + form action), the
// backend answers 202 for every non-conflicting email (including a
// deliberately BLOCKED one — that indistinguishability is a security
// property this suite guards), 409 for a taken code or a pending
// application, and the footer surfaces the entry point. A signed-in seeded
// referrer's code renders verbatim (case preserved) on /account/referral.
//
// Each mutating scenario posts a UNIQUE email + code (the backend enforces
// uniqueness on both) so the spec stays re-runnable without a reseed.
// `test.applicant@example.com` and `test.blocked@example.com` are seeded
// fixtures for the two 409/202 special cases and are never the *submitter's
// own* email elsewhere in this file.
//
// The endpoint is throttled 10/day/IP and this file spends 8 of those across
// its two browser projects, which would be cutting it fine — except the E2E
// backend runs with DISABLE_THROTTLING=True (revel-backend/.env, honoured by
// common.throttling.DisableableThrottleMixin), so the limit is not live here.
//
// NOT covered here: the flag-OFF case (no footer link, /referral/apply 404s).
// It needs SiteSettings.referral_applications_enabled toggled mid-suite, which
// the seed cannot do; `src/lib/utils/features.test.ts` covers the frontend
// half (the flag fails CLOSED). Related trap: `getFeatures` caches /version
// for 5 minutes IN THE FRONTEND PROCESS. Reseeding while a frontend server is
// already up can leave this whole file 404ing for up to 5 minutes on a stale
// cached `referral_applications: false` — restart the frontend after a reseed,
// not just the backend.
//
// Deliberately NOT the suite-wide `uniqueEmail()` factory: this endpoint
// normalizes for ban/dedup matching by stripping everything after `+` (see
// `accounts/utils/email_normalization.py`), so every `e2e+<label>-...@...`
// address it produces collapses onto the SAME identity. The very first
// submission using that pattern creates a PENDING application under it, and
// every later one — forever, until a reseed — gets misdiagnosed as the
// pending-duplicate conflict instead of whatever the test actually meant to
// exercise. A local, `+`-free generator sidesteps the collision instead.
function uniqueReferralEmail(label: string): string {
	return `e2e-${label.toLowerCase()}-${crypto.randomBytes(5).toString('hex')}@example.com`;
}

/** `^[A-Za-z0-9_-]{3,20}$` — short, lowercase-hex, always fresh. */
function uniqueCode(): string {
	return `c-${crypto.randomBytes(5).toString('hex')}`;
}

async function submitApplication(
	page: Page,
	{ email, code, note }: { email: string; code: string; note: string }
): Promise<void> {
	const form = page.locator('form');
	await form.getByLabel('Email address').fill(email);
	await form.getByLabel('Desired referral code').fill(code);
	await form.getByLabel('Tell us about yourself').fill(note);
	await form.getByRole('button', { name: 'Send application' }).click();
}

test.describe('J21 referral program: public application @p2', () => {
	test('happy path: unique email + code reach the success panel', async ({ page }) => {
		await gotoHydrated(page, '/referral/apply');
		await submitApplication(page, {
			email: uniqueReferralEmail('ReferralHappy'),
			code: uniqueCode(),
			note: 'I run a monthly queer meetup and want to bring them to Revel.'
		});

		await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
	});

	test('a taken referral code blames the code field', async ({ page }) => {
		await gotoHydrated(page, '/referral/apply');
		await submitApplication(page, {
			email: uniqueReferralEmail('ReferralCodeTaken'),
			code: 'test-partner', // seeded referrer's code — always taken
			note: 'Testing the already-taken-code conflict.'
		});

		const codeInput = page.locator('form').getByLabel('Desired referral code');
		await expect(codeInput).toHaveAttribute('aria-invalid', 'true');
		await expect(codeInput).toHaveAttribute('aria-describedby', /referral-code-error/);

		const codeError = page.locator('#referral-code-error');
		await expect(codeError).toBeVisible();
		await expect(codeError).toHaveText(/already taken/i);

		await expect(page.getByRole('heading', { name: 'Application received' })).toHaveCount(0);
	});

	test('a pending application shows a form-level banner', async ({ page }) => {
		await gotoHydrated(page, '/referral/apply');
		await submitApplication(page, {
			email: 'test.applicant@example.com', // seeded fixture: already has a pending application
			code: uniqueCode(),
			note: 'Testing the pending-application conflict.'
		});

		// The site-wide "Demo Mode" banner is also role=alert — scope to ours.
		await expect(page.getByRole('alert').filter({ hasText: /application pending/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Application received' })).toHaveCount(0);
	});

	test('a blocked email is indistinguishable from a real success', async ({ page }) => {
		// Security property: the backend deliberately answers 202 for a blocked
		// email too, so this must render the SAME success panel as the happy
		// path — anything that branched on it would leak the block to the caller.
		await gotoHydrated(page, '/referral/apply');
		await submitApplication(page, {
			email: 'test.blocked@example.com', // seeded fixture: blocked applicant
			code: uniqueCode(),
			note: 'Testing the blocked-email path.'
		});

		await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
	});

	test('a too-short code is rejected without reaching success', async ({ page }) => {
		await gotoHydrated(page, '/referral/apply');
		await submitApplication(page, {
			email: uniqueReferralEmail('ReferralShortCode'),
			code: 'ab', // fails ^[A-Za-z0-9_-]{3,20}$ — no `pattern` attr, so this exercises the server action
			note: 'Testing a too-short referral code.'
		});

		const codeInput = page.locator('form').getByLabel('Desired referral code');
		await expect(codeInput).toHaveAttribute('aria-invalid', 'true');
		await expect(page.locator('#referral-code-error')).toHaveText(/3 to 20 letters/i);
		await expect(page.getByRole('heading', { name: 'Application received' })).toHaveCount(0);
		expect(new URL(page.url()).pathname).toBe('/referral/apply');
	});

	test('the footer links a public page to the application form', async ({ page }) => {
		await gotoHydrated(page, '/events');
		const footer = page.getByRole('contentinfo');
		await footer.getByRole('link', { name: 'Referral Program' }).click();

		await page.waitForURL(/\/referral\/apply$/);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Become a Revel partner' })
		).toBeVisible();
	});

	test('the seeded referrer sees their code preserved in lowercase', async ({ browser }) => {
		const context = await browser.newContext();
		try {
			await authenticateContext(context, {
				email: 'test.referrer@example.com',
				password: 'password123'
			});
			const page = await context.newPage();

			await gotoHydrated(page, '/account/referral');
			await waitForClientAuth(page);
			// The mobile nav drawer also has a "Referral Program" heading — scope to h1.
			await expect(page.getByRole('heading', { level: 1, name: 'Referral Program' })).toBeVisible();
			await expect(page.getByText('test-partner', { exact: true })).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
