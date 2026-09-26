import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { createOrganization } from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8.3 / J16.1 (USER_JOURNEYS.md) — Stripe Connect onboarding, organizer side.
//
// The Stripe section lives on the org settings page. For an org WITHOUT an
// account the owner opens the email modal, confirms, and the backend creates
// a Standard account + one-time Account Link that the page redirects to.
// Onboarding itself happens on Stripe and is never completed here: the
// redirect to connect.stripe.com is intercepted and stubbed, which is the
// journey's hand-off point.
//
// ACCOUNT LITTER: the connect test hits the REAL Stripe test-mode API through
// the backend (accounts.create + account_links.create) — it is the only way to
// prove the backend hands back a genuine onboarding link. Every execution
// leaves ONE unfinished Standard connected account in the platform's Stripe
// test dashboard. To keep that at one per full E2E run it runs on the
// `chromium` project only and never retries.
//
// The connected-status test reads the seeded Org Alpha, whose account
// (CONNECTED_TEST_STRIPE_ID) is fully onboarded. It must stay READ-ONLY:
// POST /stripe/account/verify re-syncs Alpha's flags from Stripe, and if the
// account were ever unreachable that call flips Alpha to not-connected and
// takes every Stripe spec down with it. The section fires that verify on
// MOUNT (not only on the button), so the test intercepts it and answers with
// Alpha's persisted flags, read via the plain admin GET — the render still
// reflects real backend state, and the verify never reaches the backend.

test.describe('J16 Stripe Connect @p2', () => {
	test.describe('onboarding hand-off', () => {
		// A retry would litter a second Stripe account (see the header).
		test.describe.configure({ retries: 0 });

		test('connect button creates an onboarding link and redirects to Stripe', async ({
			browser
		}) => {
			test.skip(
				test.info().project.name !== 'chromium',
				'creates a real Stripe test account per execution — one project only, see the header'
			);
			test.setTimeout(120_000);
			const org = await createOrganization();

			const context = await browser.newContext();
			await authenticateContext(context, org.owner);
			const page = await context.newPage();
			try {
				// Stub Stripe's hosted onboarding: we only assert the hand-off.
				await page.route('https://connect.stripe.com/**', (route) =>
					route.fulfill({
						status: 200,
						contentType: 'text/html',
						body: '<!doctype html><title>Stripe onboarding (stub)</title>'
					})
				);

				await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
				await waitForClientAuth(page);

				// Not-connected state.
				await expect(page.getByRole('heading', { name: 'Stripe Not Connected' })).toBeVisible({
					timeout: 15_000
				});
				await expect(page.getByRole('link', { name: /Go to Stripe Dashboard/ })).toHaveCount(0);
				await expect(page.getByRole('button', { name: 'Verify Account Status' })).toHaveCount(0);

				await page.getByRole('button', { name: 'Connect with Stripe' }).click();
				const modal = page.getByRole('dialog', { name: 'Connect with Stripe' });
				await expect(modal).toBeVisible();
				await modal.getByLabel(/Official Business Email/).fill(org.owner.email);

				// Capture the backend's onboarding link on the way through — the
				// redirect navigates away before a waitForResponse body can be read.
				let onboardingUrl = '';
				await page.route(`**/api/organization-admin/${org.slug}/stripe/connect`, async (route) => {
					const response = await route.fetch();
					expect(response.status()).toBe(200);
					onboardingUrl = ((await response.json()) as { onboarding_url: string }).onboarding_url;
					await route.fulfill({ response });
				});
				await modal.getByRole('button', { name: 'Connect to Stripe' }).click();

				await expect.poll(() => onboardingUrl, { timeout: 45_000 }).not.toBe('');
				expect(onboardingUrl).toMatch(/^https:\/\/connect\.stripe\.com\/setup\//);

				// The page hands off to exactly the URL the backend returned.
				await page.waitForURL(onboardingUrl, { timeout: 30_000 });

				// Back on Revel without finishing onboarding: the org now holds an
				// account id, so the section reads "Setup Incomplete" and offers to
				// resume rather than start over (live verify against Stripe).
				await page.unroute('https://connect.stripe.com/**');
				await gotoHydrated(page, `/org/${org.slug}/admin/settings`);
				await waitForClientAuth(page);
				await expect(page.getByRole('heading', { name: 'Setup Incomplete' })).toBeVisible({
					timeout: 30_000
				});
				await expect(page.getByRole('button', { name: 'Complete Stripe Setup' })).toBeVisible();
				await expect(page.getByRole('button', { name: 'Connect with Stripe' })).toHaveCount(0);
			} finally {
				await context.close();
			}
		});
	});

	test('connected org renders the fully-connected status', async ({ asOwner }) => {
		const page = asOwner;
		const slug = 'revel-events-collective';

		// Read-only truth: Alpha's persisted flags (plain GET, no Stripe call).
		const api = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const alpha = await api.get<{
			stripe_charges_enabled: boolean;
			stripe_details_submitted: boolean;
		}>(`/api/organization-admin/${slug}`);
		expect(alpha.stripe_charges_enabled).toBe(true);
		expect(alpha.stripe_details_submitted).toBe(true);

		// Answer the mount-time verify from those flags — it must never reach
		// the backend (it would write Alpha's flags from a live Stripe read).
		let verifyCalls = 0;
		await page.route(`**/api/organization-admin/${slug}/stripe/account/verify`, (route) => {
			verifyCalls += 1;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					is_connected: true,
					charges_enabled: alpha.stripe_charges_enabled,
					details_submitted: alpha.stripe_details_submitted
				})
			});
		});

		await gotoHydrated(page, `/org/${slug}/admin/settings`);
		await waitForClientAuth(page);

		const section = page.locator('section').filter({
			has: page.getByRole('heading', { name: 'Payment Processing' })
		});
		await expect(section.getByRole('heading', { name: 'Stripe Connected' })).toBeVisible({
			timeout: 30_000
		});
		// Both onboarding flags read "Yes" (the definition list under the card).
		await expect(section.getByText('Details Submitted')).toBeVisible();
		await expect(section.getByText('Charges Enabled')).toBeVisible();
		await expect(section.getByText('Yes', { exact: true })).toHaveCount(2);

		// Connected orgs get the dashboard link + manual re-verify (NOT clicked
		// — see the header), never the connect/resume CTA.
		await expect(section.getByRole('link', { name: /Go to Stripe Dashboard/ })).toHaveAttribute(
			'href',
			'https://dashboard.stripe.com/'
		);
		await expect(section.getByRole('button', { name: 'Verify Account Status' })).toBeEnabled();
		await expect(section.getByRole('button', { name: 'Connect with Stripe' })).toHaveCount(0);
		await expect(section.getByRole('button', { name: 'Complete Stripe Setup' })).toHaveCount(0);

		// The interception really was exercised (the mount-time verify fired).
		expect(verifyCalls).toBeGreaterThan(0);
	});
});
