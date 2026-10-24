import { PERSONAS } from '../../support/personas';
import { test, expect } from '../../support/fixtures';
import { ApiClient, ApiError, API_URL, fetchWithRetry } from '../../support/api';
import { uniqueName } from '../../support/factories';
import { gotoHydrated } from '../../support/navigation';
import { uiLogin } from '../../support/session';

// Custom domains (#1058): the org-admin page, run on the PLATFORM host (no
// tenant mode needed). Fixtures come from the DEBUG-only `bootstrap_test_events`
// seed (backend #1162 + its seed PR):
//   - domain-setup-org: custom domains enabled, NO domain, owner tenantOwner;
//   - tenant-test-org: ACTIVE domain tenant.localhost, same owner;
//   - eligibility-test-org: custom domains NOT enabled, owner testAdmin.
// Locally POST creates a PENDING row without calling Cloudflare; the card shows
// one CNAME only when the backend has CUSTOM_DOMAIN_CNAME_TARGET set, otherwise
// the "platform team" note. Both are legal, so the spec accepts either.

const SETUP_SLUG = 'domain-setup-org';
const ACTIVE_SLUG = 'tenant-test-org';
const GATED_SLUG = 'eligibility-test-org';
const SETUP_ADMIN_PATH = `/org/${SETUP_SLUG}/admin/custom-domain`;
const API_PATH = `/api/organization-admin/${SETUP_SLUG}/custom-domain`;

const owner = PERSONAS.tenantOwner;

async function orgExists(slug: string): Promise<boolean> {
	try {
		const res = await fetchWithRetry(`${API_URL}/api/organizations/${slug}`, {
			signal: AbortSignal.timeout(10_000)
		});
		return res.ok;
	} catch {
		return false;
	}
}

/** Delete whatever domain the setup org holds; a 404 means there was none. */
async function clearSetupDomain(api: ApiClient): Promise<void> {
	try {
		await api.delete(API_PATH);
	} catch (error) {
		if (!(error instanceof ApiError && error.status === 404)) throw error;
	}
}

test.describe('J30 custom domain admin page @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		// Desktop Chromium only: the admin tab strip is desktop-only and the
		// j30 fixtures target `*.localhost` hostnames.
		testInfo.skip(testInfo.project.name !== 'chromium', 'j30 runs on desktop chromium only');

		if (!(await orgExists(SETUP_SLUG))) {
			testInfo.skip(true, `${SETUP_SLUG} is not seeded (backend lacks the custom-domain seed)`);
			return;
		}
		const api = await ApiClient.login(owner.email, owner.password);
		try {
			await api.get(API_PATH);
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) {
				testInfo.skip(true, 'Admin custom-domain endpoint missing (backend without #1162)');
				return;
			}
			throw error;
		}
	});

	test('owner connects, checks and removes a domain', async ({ browser }) => {
		// Re-runnable: drop a leftover domain from an aborted run first.
		const api = await ApiClient.login(owner.email, owner.password);
		await clearSetupDomain(api);

		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			await uiLogin(
				page,
				{ email: owner.email, password: owner.password },
				{
					startAt: `/login?returnUrl=${encodeURIComponent(SETUP_ADMIN_PATH)}`,
					landsOn: /\/org\/domain-setup-org\/admin\/custom-domain/
				}
			);

			// Explainer + form.
			await expect(page.getByRole('heading', { name: 'Custom domain', level: 1 })).toBeVisible();
			await expect(page.getByTestId('state-none')).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Use your own domain' })).toBeVisible();
			const input = page.getByLabel('Domain name');
			await expect(input).toBeVisible();

			// An IP is refused by the backend; the message sits next to the field.
			await input.fill('127.0.0.1');
			await page.getByRole('button', { name: 'Connect domain' }).click();
			await expect(page.locator('#custom-domain-hostname-errors')).toBeVisible();
			await expect(input).toHaveAttribute('aria-invalid', 'true');
			await expect(page.getByTestId('state-none')).toBeVisible();

			// A unique *.localhost hostname is accepted under DEBUG.
			const suffix = uniqueName('cd')
				.replace(/[^a-z0-9]+/gi, '-')
				.toLowerCase();
			const hostname = `setup-${suffix}.localhost`;
			await input.fill(hostname);
			await page.getByRole('button', { name: 'Connect domain' }).click();

			const pending = page.getByTestId('state-pending');
			await expect(pending).toBeVisible();
			await expect(page.getByTestId('domain-hostname')).toHaveText(hostname);
			await expect(pending.getByTestId('status-badge')).toHaveText('Waiting for DNS');
			// Either DNS records (backend has a CNAME target) or the platform-team note.
			await expect(
				page.getByTestId('dns-record').first().or(page.getByTestId('pending-platform-team'))
			).toBeVisible();

			// "Check now" re-syncs and, locally, stays pending.
			const checkNow = page.getByRole('button', { name: 'Check now' });
			const refreshed = page.waitForResponse(
				(res) => res.url().includes(`${API_PATH}/refresh`) && res.request().method() === 'POST'
			);
			await checkNow.click();
			expect((await refreshed).ok()).toBe(true);
			await expect(checkNow).toBeEnabled();
			await expect(pending).toBeVisible();
			await expect(page.getByTestId('domain-hostname')).toHaveText(hostname);

			// Remove, confirm, back to the form.
			await page.getByRole('button', { name: 'Remove domain' }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog.getByText('Remove this domain?')).toBeVisible();
			await dialog.getByRole('button', { name: 'Remove domain' }).click();
			await expect(page.getByTestId('state-none')).toBeVisible();
			await expect(page.getByLabel('Domain name')).toBeVisible();
		} finally {
			await clearSetupDomain(api);
			await context.close();
		}
	});

	test('owner of an organization with an active domain sees it, and no form', async ({
		browser
	}) => {
		test.skip(!(await orgExists(ACTIVE_SLUG)), `${ACTIVE_SLUG} is not seeded`);

		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			const path = `/org/${ACTIVE_SLUG}/admin/custom-domain`;
			await uiLogin(
				page,
				{ email: owner.email, password: owner.password },
				{
					startAt: `/login?returnUrl=${encodeURIComponent(path)}`,
					landsOn: /\/org\/tenant-test-org\/admin\/custom-domain/
				}
			);

			await expect(page.getByTestId('state-active')).toBeVisible();
			await expect(page.getByTestId('domain-hostname')).toHaveText('tenant.localhost');
			await expect(page.getByTestId('state-active').getByTestId('status-badge')).toHaveText(
				'Active'
			);
			await expect(page.getByText(/Verified on /)).toBeVisible();
			await expect(page.getByLabel('Domain name')).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Connect domain' })).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test('an organization without the feature sees how to request it, not the manager', async ({
		browser
	}) => {
		test.skip(!(await orgExists(GATED_SLUG)), `${GATED_SLUG} is not seeded`);

		const admin = PERSONAS.testAdmin;
		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			await uiLogin(page, { email: admin.email, password: admin.password });

			await gotoHydrated(page, `/org/${GATED_SLUG}/admin/custom-domain`);
			await expect(
				page.getByRole('heading', { name: "Custom domains aren't turned on for your organization" })
			).toBeVisible();
			// The manager (and its owner-only API calls) never mounts.
			await expect(page.getByLabel('Domain name')).toHaveCount(0);
			// When the backend publishes a support address, the request is a mailto link.
			const contact = page.getByRole('link', { name: /^Email / });
			if ((await contact.count()) > 0) {
				await expect(contact).toHaveAttribute('href', /^mailto:[^?]+\?subject=/);
			}

			// The owner's nav still offers the entry, so the feature is discoverable.
			await gotoHydrated(page, `/org/${GATED_SLUG}/admin`);
			await expect(
				page.getByRole('link', { name: 'Custom domain' }).filter({ visible: true }).first()
			).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
