import type { Locator, Page } from '@playwright/test';
import { test, expect, PERSONAS } from '../../support/fixtures';
import { uiLogin } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';
import { revealLoginForm } from '../../support/auth-forms';

// J3 (USER_JOURNEYS.md) — session basics: login (happy + bad credentials),
// persona-fixture session restore, logout. Also guards #485: the navbar must
// reflect the authenticated session immediately after login, with no reload.
//
// Chrome differs by viewport: on desktop the user menu / Login link live in
// the header; on mobile both sit behind the hamburger (MobileNav renders the
// mobile UserMenu variant with its own Log Out button).
//
// The mobile drawer is off-canvas (translate-x-full) rather than unmounted, so
// its contents count as "visible" to Playwright even when closed — mobile
// assertions must use toBeInViewport(), and opening the drawer retries the
// click because a tap that lands before hydration is silently lost.

function mobileDrawer(page: Page): Locator {
	return page.getByRole('dialog', { name: 'Mobile navigation' });
}

async function openMobileNav(page: Page): Promise<void> {
	await expect(async () => {
		await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
		await expect(mobileDrawer(page)).toBeInViewport({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });
}

async function expectAuthenticatedChrome(page: Page, isMobile: boolean): Promise<void> {
	if (isMobile) {
		await openMobileNav(page);
		const drawer = mobileDrawer(page);
		// The drawer body scrolls; Log Out sits at the bottom of the menu. The
		// authenticated nav is still settling as client auth bootstraps, so the
		// button can detach mid-scroll ("element is not stable") — retry the
		// scroll+viewport assertion together, re-resolving the locator each pass.
		const logoutButton = drawer.getByRole('button', { name: 'Log Out' });
		await expect(async () => {
			await logoutButton.scrollIntoViewIfNeeded();
			await expect(logoutButton).toBeInViewport({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await expect(drawer.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
		await drawer.getByRole('button', { name: 'Close menu' }).click();
	} else {
		await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
	}
}

async function expectLoggedOutChrome(page: Page, isMobile: boolean): Promise<void> {
	if (isMobile) {
		await openMobileNav(page);
		const drawer = mobileDrawer(page);
		// Same re-render race as the authenticated variant (see above).
		const loginLink = drawer.getByRole('link', { name: 'Login', exact: true });
		await expect(async () => {
			await loginLink.scrollIntoViewIfNeeded();
			await expect(loginLink).toBeInViewport({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await expect(drawer.getByRole('button', { name: 'Log Out' })).toBeHidden();
		await drawer.getByRole('button', { name: 'Close menu' }).click();
	} else {
		await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'User menu' })).toBeHidden();
	}
}

async function logout(page: Page, isMobile: boolean): Promise<void> {
	if (isMobile) {
		await openMobileNav(page);
		await mobileDrawer(page).getByRole('button', { name: 'Log Out' }).click();
	} else {
		await page.getByRole('button', { name: 'User menu' }).click();
		// The desktop dropdown entry is role="menuitem", not a plain button.
		await page.getByRole('menuitem', { name: 'Log Out' }).click();
	}
	// The /logout load clears cookies and redirects home with a full reload.
	await page.waitForURL(/logged_out=true/);
}

test.describe('J3 login & logout @p0', () => {
	test('logs in via the UI and the navbar reflects the session without a reload (#485)', async ({
		page,
		isMobile
	}) => {
		await uiLogin(page, 'user');
		await expectAuthenticatedChrome(page, isMobile);
	});

	test('rejects invalid credentials with an accessible error and stays on /login', async ({
		page
	}) => {
		// Demo backends default to the test-account dropdown; reveal the real
		// password form first (#600 — no-op on non-demo backends).
		await gotoHydrated(page, '/login');
		await revealLoginForm(page);
		await page.getByLabel('Email address').fill(PERSONAS.user.email);
		await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-password');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();

		// The demo-mode banner is also role=alert — exclude it.
		await expect(page.getByRole('alert').filter({ hasNotText: 'Demo Mode' })).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/login');
	});

	test('restores an authenticated session from persona fixture cookies', async ({
		asUser,
		isMobile
	}) => {
		// The persona fixture context has only planted auth cookies — reaching
		// the dashboard proves the SSR cold-start path (hooks.server.ts) and the
		// client bootstrap accept them.
		await asUser.goto('/dashboard');
		await expect(asUser).toHaveURL(/\/dashboard(\/|$|\?)/);
		await expectAuthenticatedChrome(asUser, isMobile);
	});

	test('logs out and returns to the logged-out chrome', async ({ page, isMobile }) => {
		// Log in via the UI so the whole login → logout cycle is exercised on one
		// real session (logout blacklists the refresh token, so a session this
		// test fully owns is also the safest thing to burn).
		await uiLogin(page, 'member');

		await logout(page, isMobile);
		await expectLoggedOutChrome(page, isMobile);

		// The cookies are really gone server-side: a fresh SSR load still renders
		// the logged-out chrome (no lingering session re-hydration).
		await page.goto('/');
		await expectLoggedOutChrome(page, isMobile);
	});
});
