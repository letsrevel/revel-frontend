import { test, expect } from '../../support/fixtures';
import { API_URL, fetchWithRetry } from '../../support/api';
import { createVerifiedUser } from '../../support/factories';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J21.8 (USER_JOURNEYS.md) — the signed-in entry point to the public
// referral-program application (FE #939): /account/profile shows a
// "Referral Program" section linking to /referral/apply for users who are
// NOT referrers yet, and hides it for enrolled referrers (who already get the
// referral entries in the user menu — offering them "apply" would send them
// to a form the backend silently 202s).
//
// Both halves are gated on `features.referral_applications` from /version,
// which bootstrap_test_events switches on; the flag-off case is covered by
// apply.spec's note (it can't be toggled mid-suite). Read-only: the
// non-referrer is a throwaway, the referrer is the seeded test.referrer
// (only its code is read elsewhere).

const REFERRER = { email: 'test.referrer@example.com', password: 'password123' };
const CTA = 'Apply to the referral program';

async function referralApplicationsEnabled(): Promise<boolean> {
	const response = await fetchWithRetry(`${API_URL}/api/version`);
	const body = (await response.json()) as { features?: { referral_applications?: boolean } };
	return body.features?.referral_applications === true;
}

test.describe('J21 referral program: profile entry point @p2', () => {
	test.beforeEach(async () => {
		test.skip(
			!(await referralApplicationsEnabled()),
			'referral applications are switched off on this backend'
		);
	});

	test('a non-referrer is offered the application from their profile', async ({ browser }) => {
		const user = await createVerifiedUser('ReferralEntry');
		const page = await pageAs(browser, user);
		try {
			await gotoHydrated(page, '/account/profile');
			await waitForClientAuth(page);

			const cta = page.getByRole('link', { name: CTA });
			await expect(cta).toBeVisible();
			await cta.click();
			await page.waitForURL(/\/referral\/apply$/);
			await expect(
				page.getByRole('heading', { level: 1, name: 'Become a Revel partner' })
			).toBeVisible();
		} finally {
			await page.context().close();
		}
	});

	test('an enrolled referrer is not offered the application', async ({ browser }) => {
		const page = await pageAs(browser, REFERRER);
		try {
			await gotoHydrated(page, '/account/profile');
			await waitForClientAuth(page);

			// Positive anchor first: the user menu's referral entry renders only
			// once the client-side user (with its referral_code) has loaded —
			// the same moment the profile section's gate is decided. Without it
			// the absence check below could pass on a not-yet-loaded user.
			await expect(page.locator('a[href="/account/referral"]').first()).toBeAttached();
			await expect(page.getByRole('link', { name: CTA })).toHaveCount(0);
		} finally {
			await page.context().close();
		}
	});
});
