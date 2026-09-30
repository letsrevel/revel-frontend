import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, isolatedEmail, type ThrowawayUser } from '../../support/factories';
import { API_URL } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Browser, Page } from '@playwright/test';

// J15.9 (USER_JOURNEYS.md) — suppressed address: a hard bounce / invalid /
// blocked / spam-complaint event from the email provider suppresses the
// account's current address. The app shows a banner globally (dismissible for
// the session) and in account settings (not dismissible): why, since when,
// that tickets and receipts are still in the app, and the two ways out
// (change email, contact support). No self-service unblock.
//
// Arrange: the E2E backend accepts provider events on the Brevo webhook with a
// fixed test-only secret (revel-backend#1045, E2E_GUNICORN
// EMAIL_WEBHOOK_SECRET). Suppression is keyed by the NORMALIZED address (+tags
// stripped) and can't be cleared through the API, so each test uses a fresh
// user on an isolatedEmail(): a `+tag` address would suppress every E2E mailbox.

const WEBHOOK_SECRET = process.env.E2E_EMAIL_WEBHOOK_SECRET ?? 'e2e-webhook-secret';

async function suppress(email: string, event: 'hard_bounce' | 'spam'): Promise<void> {
	const response = await fetch(`${API_URL}/api/email-events/brevo`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${WEBHOOK_SECRET}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ event, email })
	});
	// 404 = no EMAIL_WEBHOOK_SECRET configured (feature off), 401 = a different one.
	test.skip(
		response.status === 404 || response.status === 401,
		'E2E backend has no matching email webhook secret (needs revel-backend#1045 + make e2e-setup)'
	);
	expect(response.status).toBe(200);
}

async function signedInPage(browser: Browser, user: ThrowawayUser): Promise<Page> {
	const context = await browser.newContext();
	await authenticateContext(context, user);
	return context.newPage();
}

test.describe('J15 suppressed address @p2', () => {
	test('a hard bounce shows the banner app-wide and in settings', async ({ browser }) => {
		const user = await createVerifiedUser('Bounced', { email: isolatedEmail('Bounced') });
		await suppress(user.email, 'hard_bounce');
		const page = await signedInPage(browser, user);

		await gotoHydrated(page, '/dashboard');
		await waitForClientAuth(page);
		const banner = page.getByRole('region', { name: "Emails to this address can't be delivered." });
		await expect(banner).toBeVisible();
		await expect(banner).toContainText('tickets and receipts are still in the app');
		await expect(banner.getByRole('link', { name: 'Change email address' })).toHaveAttribute(
			'href',
			'/account/security#email'
		);
		await expect(banner.getByRole('link', { name: 'Contact support' })).toHaveAttribute(
			'href',
			/^mailto:/
		);

		// Dismissed for the session: stays hidden across a reload.
		await banner.getByRole('button', { name: 'Dismiss' }).click();
		await expect(banner).toBeHidden();
		await page.reload();
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(banner).toBeHidden();

		// Account settings always shows it, without a dismiss.
		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		const inline = page.getByRole('region', { name: "Emails to this address can't be delivered." });
		await expect(inline).toBeVisible();
		await expect(inline.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
	});

	test('a spam complaint is named as such', async ({ browser }) => {
		const user = await createVerifiedUser('Complained', {
			email: isolatedEmail('Complained')
		});
		await suppress(user.email, 'spam');
		const page = await signedInPage(browser, user);

		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		await expect(
			page.getByRole('region', { name: 'This address marked one of our emails as spam.' })
		).toBeVisible();
	});
});
