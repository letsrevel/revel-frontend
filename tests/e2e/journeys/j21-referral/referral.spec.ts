import { test, expect } from '../../support/fixtures';
import { fetchWithRetry, getBackendUrl } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { ReferralPage } from '../../support/pages/referral';

// J21 (USER_JOURNEYS.md) — the referrer surface: a seeded B2B referrer sees
// their code on /account/referral and a PAID payout with a downloadable
// self-billing statement on /account/referral/payouts. The referrer accounts
// use password "password" (NOT the persona bootstrap password), and both
// referral routes redirect users without a referral code away — so this must
// run as an actual referrer.
//
// Payout amounts are computed from the previous month's real payments, so we
// assert the "Paid" status + a viewable statement, never an exact figure.

const REFERRER = { email: 'referrer.b2b@example.com', password: 'password' };

test.describe('J21 referral program @p2', () => {
	test('shows the referral code and a paid payout statement', async ({ browser }) => {
		const context = await browser.newContext();
		try {
			await authenticateContext(context, REFERRER);
			const page = await context.newPage();

			const referralPage = new ReferralPage(page);

			await referralPage.gotoReferral();
			await referralPage.expectReferralPage('B2BREF01');

			await referralPage.gotoPayouts();
			await referralPage.expectPayoutsPage();
			await referralPage.openPayoutStatement();

			// Exercise the actual download: the button hits the statement-download
			// endpoint for a signed PDF URL (then opens it in a new tab). Assert the
			// request succeeds and the signed URL it returns is itself fetchable.
			const downloadResponse = await referralPage.triggerPdfDownload();
			expect(downloadResponse.status()).toBe(200);
			const { download_url } = (await downloadResponse.json()) as { download_url: string };
			expect(download_url).toContain('/media/');

			const resolvedUrl = getBackendUrl(download_url);
			const pdf = await fetchWithRetry(resolvedUrl);
			expect(pdf.status).toBe(200);
			expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(0);
		} finally {
			await context.close();
		}
	});
});
