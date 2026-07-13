import { test, expect } from '../../support/fixtures';
import { getBackendUrl } from '../../support/api';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J25 (USER_JOURNEYS.md) — revenue report: "Download report" on the org
// Financials page requests a ZIP export (XLSX + PDF bundle), polls the export
// until READY, and downloads it via a synthetic <a download> click. The spec
// observes the app's own network traffic instead of re-implementing the poll
// (the status endpoint needs the app's bearer token; the final download_url
// is a signed URL fetchable without auth).
//
// Identical requests are served from a cached READY export whose download_url
// arrives directly on the POST — the second project's run usually takes that
// path, so nothing here asserts on the transient "Generating…" toast or the
// poll traffic being present. The "ready" toast fires on both paths.
//
// Read-only on seeded data: Org Alpha's back-dated previous-month sales exist
// from bootstrap and the default report period (Jan 1 → today) covers them.

const FINANCIALS_PATH = '/org/revel-events-collective/admin/financials';

test.describe('J25 revenue report @p3', () => {
	test('request ZIP report → ready toast → download resolves a ZIP', async ({ asOwner: page }) => {
		test.setTimeout(180_000);

		await gotoHydrated(page, FINANCIALS_PATH);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Financials', level: 1 })).toBeVisible();

		const createResponse = page.waitForResponse(
			(r) =>
				/\/api\/organization-admin\/[^/]+\/revenue-report(\?|$)/.test(r.url()) &&
				r.request().method() === 'POST' &&
				r.status() < 300,
			{ timeout: 30_000 }
		);
		await page.getByRole('button', { name: 'Download report' }).click();
		const created = (await (await createResponse).json()) as {
			id: string;
			download_url: string | null;
		};

		// Cache hit → the URL is already on the POST; otherwise observe the
		// button's own 2s polling until a poll answers with a download_url.
		let downloadUrl = created.download_url;
		if (!downloadUrl) {
			const readyPoll = await page.waitForResponse(
				async (r) => {
					if (!/\/revenue-reports\//.test(r.url()) || !r.ok()) return false;
					const body = (await r.json().catch(() => null)) as {
						download_url?: string | null;
					} | null;
					return !!body?.download_url;
				},
				{ timeout: 130_000 }
			);
			downloadUrl = ((await readyPoll.json()) as { download_url: string }).download_url;
		}

		await expect(page.getByText('Your report is ready.')).toBeVisible({ timeout: 130_000 });

		// The signed URL serves the actual ZIP bundle.
		const zip = await page.request.get(getBackendUrl(downloadUrl));
		expect(zip.status()).toBe(200);
		expect(zip.headers()['content-type'] ?? '').toContain('zip');
	});
});
