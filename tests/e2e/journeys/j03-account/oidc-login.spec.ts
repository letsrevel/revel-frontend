import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { ssoProvider } from '../../support/skip';
import { loginAtKeycloak, createKeycloakUser } from '../../support/keycloak';
import { createVerifiedUser, uniqueEmail } from '../../support/factories';
import { waitForEmail, extractLink } from '../../support/mailpit';
import { API_URL } from '../../support/api';

// J03 — generic OIDC login end to end through the e2e Keycloak overlay
// (revel-backend PR #920; FE issue #875). Every test uses per-run throwaway
// users: the spec runs in two browser projects with parallel workers, so
// mutating a shared persona's identities (link/unlink) would race.
//
// Self-skips when the backend was started without the overlay.

const SKIP_MESSAGE =
	'Backend lists no `keycloak` SSO provider — start the stack with `make e2e-setup` ' +
	'(backend on feature/e2e-keycloak or later, Keycloak overlay up)';

const NEW_PASSWORD = 'E2e-oidc-Pass!123';

/** The provider's DISPLAY name, as /api/version reports it ("Keycloak (e2e)"). */
let providerName = 'Keycloak';

/**
 * The page's own error banner. The layout's demo-mode banner is ALSO
 * `role="alert"` (and the e2e backend reports `demo: true`), so an unfiltered
 * getByRole('alert') is strict-mode ambiguous — same guard as j03 login-logout.
 */
function errorAlert(page: Page): Locator {
	return page.getByRole('alert').filter({ hasNotText: 'Demo Mode' });
}

test.describe('J03 OIDC login @p1', () => {
	test.beforeEach(async () => {
		const provider = await ssoProvider('keycloak');
		test.skip(!provider, SKIP_MESSAGE);
		if (provider) {
			providerName = provider.name;
		}
	});

	test('existing verified account auto-links, lands on returnUrl, unlink succeeds', async ({
		page
	}) => {
		test.setTimeout(120_000);
		const revelUser = await createVerifiedUser('OidcLink');
		await createKeycloakUser({ email: revelUser.email });

		await gotoHydrated(page, '/login?returnUrl=%2Fevents');
		await page.getByRole('link', { name: /Continue with Keycloak/ }).click();
		await loginAtKeycloak(page, revelUser.email);

		// The IdP identity auto-linked to the pre-existing Revel account and the
		// hand-off honoured the returnUrl carried through start → callback.
		await page.waitForURL(/\/events(\?|$)/);
		await waitForClientAuth(page);

		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Linked sign-in methods' })).toBeVisible();
		// The identity row — scoped by email so it can't match the security tips
		// list or the nav.
		const identityRow = page.getByRole('listitem').filter({ hasText: revelUser.email });
		await expect(identityRow).toBeVisible();
		await expect(identityRow).toContainText(providerName);

		// Unlink is allowed: the account has a password.
		await page.getByRole('button', { name: /^Unlink Keycloak/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click();
		await expect(page.getByText('No linked sign-in methods.')).toBeVisible();
	});

	test('first login creates the account; unlink refused until a password is set', async ({
		page
	}) => {
		test.setTimeout(240_000);
		const email = uniqueEmail('oidc-new');
		await createKeycloakUser({ email });

		await gotoHydrated(page, '/login');
		await page.getByRole('link', { name: /Continue with Keycloak/ }).click();
		await loginAtKeycloak(page, email);
		// No returnUrl was given: the backend's safe_return_url defaults the
		// hand-off target to "/", so a bare OIDC login lands on the home page
		// (NOT /dashboard — that is the frontend's own login-form fallback).
		await page.waitForURL('/');
		await waitForClientAuth(page);

		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Linked sign-in methods' })).toBeVisible();

		// No password, only the identity → the backend refuses to strip the
		// account's only way in, and the card surfaces the detail as an alert.
		await page.getByRole('button', { name: /^Unlink Keycloak/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click();
		await expect(errorAlert(page)).toContainText('password');
		await expect(page.getByText('No linked sign-in methods.')).toBeHidden();

		// Set a password through the security page's reset flow…
		await page.getByRole('button', { name: 'Change Password' }).click();
		await page.getByRole('button', { name: 'Send Reset Link' }).click();
		await expect(page.getByText('Password reset link sent!')).toBeVisible();

		const message = await waitForEmail({ to: email, subject: 'Password reset request' });
		const link = extractLink(message, /reset-password\?token=/);
		await gotoHydrated(page, link);

		// Same fill-until-it-lands loop as j17 password-reset: the submit is
		// enabled from first render, so a fill in the hydration-settling window
		// can be swallowed by the input bindings catching up.
		const password = page.getByLabel('New password');
		const confirm = page.getByLabel('Confirm password');
		await expect(async () => {
			await password.fill(NEW_PASSWORD);
			await confirm.fill(NEW_PASSWORD);
			await expect(password).toHaveValue(NEW_PASSWORD, { timeout: 2_000 });
			await expect(confirm).toHaveValue(NEW_PASSWORD, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Reset password' }).click();
		await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();

		// …and now the identity is no longer the only way in.
		await gotoHydrated(page, '/account/security');
		await waitForClientAuth(page);
		await page.getByRole('button', { name: /^Unlink Keycloak/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click();
		await expect(page.getByText('No linked sign-in methods.')).toBeVisible();
	});

	test('unverified IdP email is refused with a message on /login', async ({ page }) => {
		const email = uniqueEmail('oidc-unverified');
		await createKeycloakUser({ email, emailVerified: false });

		await gotoHydrated(page, '/login');
		await page.getByRole('link', { name: /Continue with Keycloak/ }).click();
		await loginAtKeycloak(page, email);

		await page.waitForURL(/\/login\?error=oidc_unverified_email/);
		await expect(errorAlert(page)).toContainText('not verified');
	});

	test('a denied authorization lands back on /login with the cancelled message', async ({
		page
	}) => {
		await gotoHydrated(page, '/login');
		await page.getByRole('link', { name: /Continue with Keycloak/ }).click();
		// We really are at the provider (state cookie set, PKCE challenge issued).
		await page.locator('#kc-login').waitFor();

		// Keycloak's login page has NO cancel/back affordance to click: the
		// keycloak.v2 login.ftl renders only #username, #password and #kc-login
		// (verified against this realm's live page — no #kc-cancel, no restart
		// link; consent is off for the revel-backend client). A user who declines
		// therefore reaches us the only way an IdP can say so: the provider
		// redirects the browser back to the callback with `error=access_denied`.
		// Driving that redirect here exercises the real backend callback →
		// /login?error=oidc_denied → banner path with the live state cookie in
		// place, which is the frontend behaviour under test.
		await page.goto(`${API_URL}/api/auth/oidc/keycloak/callback?error=access_denied`);

		await page.waitForURL(/\/login\?error=oidc_denied/);
		await expect(errorAlert(page)).toContainText('cancelled');
	});
});
