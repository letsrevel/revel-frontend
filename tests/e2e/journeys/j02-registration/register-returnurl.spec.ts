import { test, expect } from '../../support/fixtures';
import { uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { fillRegistrationForm } from '../../support/auth-forms';

// J2.1 + #953 PR 0 — a user sent to /register?returnUrl=… (e.g. from a login
// page that was itself opened with a return target) lands on that target after
// verifying their email. The target rides the verification link as
// `&returnUrl=` (BE #1023); nothing is stored on the device. An unsafe value
// falls back to the profile page.

const STRONG_PASSWORD = 'E2e-test-Pass!123';

test.describe('J2 registration honors returnUrl @p1', () => {
	test('lands on the returnUrl after verifying', async ({ page }) => {
		const email = uniqueEmail('RegReturn');
		const target = '/account/memberships';

		await fillRegistrationForm(page, email, STRONG_PASSWORD, {
			startAt: `/register?returnUrl=${encodeURIComponent(target)}`
		});
		await page.getByRole('button', { name: 'Create your account' }).click();

		// The check-email interstitial keeps the target on its "back to login" link.
		await page.waitForURL(/\/register\/check-email\?.*returnUrl=/);
		await expect(page.getByRole('link', { name: 'Back to login' })).toHaveAttribute(
			'href',
			`/login?returnUrl=${encodeURIComponent(target)}`
		);

		const message = await waitForEmail({ to: email });
		const link = extractLink(message, /token=/);
		expect(link).toContain('returnUrl=%2Faccount%2Fmemberships');

		await page.goto(link);
		await page.waitForURL(/\/account\/memberships/);
	});

	test('resent verification link keeps the returnUrl', async ({ page }) => {
		// #978 — "Resend verification email" on the check-email page must send
		// the same target, or the re-sent link drops the user on /account/profile.
		const email = uniqueEmail('RegReturnResend');
		const target = '/account/memberships';

		await fillRegistrationForm(page, email, STRONG_PASSWORD, {
			startAt: `/register?returnUrl=${encodeURIComponent(target)}`
		});
		await page.getByRole('button', { name: 'Create your account' }).click();
		await page.waitForURL(/\/register\/check-email\?.*returnUrl=/);

		// Record the original email so the wait below can only match the resend
		// (the mailbox is shared across parallel projects; never wipe it).
		const first = await waitForEmail({ to: email });

		await page.getByRole('button', { name: 'Resend verification email' }).click();
		await expect(
			page.getByRole('status').filter({ hasText: 'Verification email sent' })
		).toBeVisible();

		const resent = await waitForEmail({ to: email, excludeIds: [first.ID] });
		const link = extractLink(resent, /token=/);
		expect(link).toContain('returnUrl=%2Faccount%2Fmemberships');

		await page.goto(link);
		await page.waitForURL(/\/account\/memberships/);
	});

	test('falls back to the profile page for an unsafe returnUrl', async ({ page }) => {
		const email = uniqueEmail('RegReturnBad');

		await fillRegistrationForm(page, email, STRONG_PASSWORD, {
			startAt: `/register?returnUrl=${encodeURIComponent('//evil.example')}`
		});
		await page.getByRole('button', { name: 'Create your account' }).click();
		await page.waitForURL(/\/register\/check-email/);

		const message = await waitForEmail({ to: email });
		const link = extractLink(message, /token=/);
		expect(link).not.toContain('returnUrl=');

		await page.goto(link);
		await page.waitForURL(/\/account\/profile/);
	});
});
