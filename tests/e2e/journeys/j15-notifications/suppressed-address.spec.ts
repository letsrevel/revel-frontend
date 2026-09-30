import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, isolatedEmail, type ThrowawayUser } from '../../support/factories';
import { API_URL, fetchWithRetry } from '../../support/api';
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
const WEBHOOK_URL = `${API_URL}/api/email-events/brevo`;

function postEvent(body: unknown): Promise<Response> {
	return fetchWithRetry(WEBHOOK_URL, {
		method: 'POST',
		headers: { Authorization: `Bearer ${WEBHOOK_SECRET}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

/**
 * Feature probe, once per worker, BEFORE any user is created. Only 404 (no
 * EMAIL_WEBHOOK_SECRET configured: feature off) skips, which only happens on
 * a backend older than revel-backend#1045 (listed in the README baseline). A 401 means the backend has a DIFFERENT secret: a misconfiguration
 * that must fail loudly, not self-skip into a false green.
 */
let probe: Promise<number> | undefined;
function webhookStatus(): Promise<number> {
	probe ??= postEvent([]).then((response) => response.status);
	return probe;
}

async function suppress(email: string, event: 'hard_bounce' | 'spam'): Promise<void> {
	// A `+tag` address would suppress every E2E mailbox (normalization strips it).
	expect(email, 'suppress only isolatedEmail() addresses').not.toContain('+');
	const response = await postEvent({ event, email });
	expect(response.status).toBe(200);
}

async function withSignedInPage(
	browser: Browser,
	user: ThrowawayUser,
	run: (page: Page) => Promise<void>
): Promise<void> {
	const context = await browser.newContext();
	try {
		await authenticateContext(context, user);
		await run(await context.newPage());
	} finally {
		await context.close();
	}
}

test.describe('J15 suppressed address @p2', () => {
	test.beforeEach(async () => {
		const status = await webhookStatus();
		test.skip(
			status === 404,
			'E2E backend has no EMAIL_WEBHOOK_SECRET (older than revel-backend#1045)'
		);
		expect(status, 'webhook rejected the E2E secret (misconfigured?)').toBe(200);
	});

	test('a hard bounce shows the banner app-wide and in settings', async ({ browser }) => {
		const user = await createVerifiedUser('Bounced', { email: isolatedEmail('Bounced') });
		await suppress(user.email, 'hard_bounce');
		await withSignedInPage(browser, user, async (page) => {
			await gotoHydrated(page, '/dashboard');
			await waitForClientAuth(page);
			const banner = page.getByRole('region', {
				name: "Emails to this address can't be delivered."
			});
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

			// Dismissed for the session: stays hidden across a reload. Assert only
			// once the preferences the banner reads have loaded, or "hidden" would
			// pass merely because the data isn't there yet.
			await banner.getByRole('button', { name: 'Dismiss' }).click();
			await expect(banner).toBeHidden();
			const preferencesLoaded = page.waitForResponse(
				(response) => response.url().endsWith('/api/notification-preferences') && response.ok()
			);
			await page.reload();
			await preferencesLoaded;
			await waitForClientAuth(page);
			await expect(banner).toBeHidden();

			// Account settings always shows it, without a dismiss.
			await gotoHydrated(page, '/account/settings');
			await waitForClientAuth(page);
			const inline = page.getByRole('region', {
				name: "Emails to this address can't be delivered."
			});
			await expect(inline).toBeVisible();
			await expect(inline.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
		});
	});

	test('a spam complaint is named as such', async ({ browser }) => {
		const user = await createVerifiedUser('Complained', {
			email: isolatedEmail('Complained')
		});
		await suppress(user.email, 'spam');
		await withSignedInPage(browser, user, async (page) => {
			await gotoHydrated(page, '/account/settings');
			await waitForClientAuth(page);
			await expect(
				page.getByRole('region', { name: 'This address marked one of our emails as spam.' })
			).toBeVisible();
		});
	});
});
