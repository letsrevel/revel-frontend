import { test, expect } from '../../support/fixtures';
import { API_URL, fetchWithRetry } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { extractLink, waitForEmail } from '../../support/mailpit';

// J17.4 (USER_JOURNEYS.md) — GDPR data export: request on /account/privacy,
// the export generates inline (eager Celery) and the download link arrives
// BY EMAIL — a time-limited signed BACKEND url (/media/...?exp=&sig=), not a
// frontend route, so it's fetched directly rather than page.goto'd.
//
// Throwaway user: the endpoint is rate-limited to one export per 24h.

test.describe('J17 GDPR export @p2', () => {
	test('requests an export and downloads it via the emailed signed link', async ({ browser }) => {
		test.setTimeout(150_000);
		const user = await createVerifiedUser('Gdpr');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/privacy');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Export Your Data' })).toBeVisible();

		await page.getByRole('button', { name: 'Request Data Export' }).click();
		await expect(page.getByText('Data export request received')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Export Requested' })).toBeDisabled();

		// Eager Celery generates the file and sends the "ready" email as soon
		// as the request transaction commits (the failure path has a distinct
		// subject, so this also asserts generation succeeded).
		const message = await waitForEmail(
			{ to: user.email, subject: 'Your Revel Data Export is Ready' },
			60_000
		);
		// The signed URL keeps its query HTML-encoded (&amp;sig=) until
		// extractLink decodes it — match on the protected media path instead.
		const link = extractLink(message, /\/media\/protected\//);

		// The link is built from the backend's BASE_URL (the frontend origin in
		// this env), but the protected media is served by the backend — the
		// signature covers only the path, so re-point the host at the API.
		const backendLink = link.replace(/^https?:\/\/[^/]+/, API_URL);
		const response = await fetchWithRetry(backendLink);
		expect(response.status).toBe(200);
		const body = await response.arrayBuffer();
		expect(body.byteLength).toBeGreaterThan(0);

		await context.close();
	});
});
