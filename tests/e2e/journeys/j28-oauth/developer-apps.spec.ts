import type { BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { createVerifiedUser, uniqueName, type ThrowawayUser } from '../../support/factories';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import { OAUTH_CALLBACK, deleteApp } from '../../support/oauth';

// J28.1 (USER_JOURNEYS.md) — a developer registers a public app through the
// UI, sees its client ID and status, deactivates it and deletes it. The
// developer is a throwaway user so the empty state is real and the 10-app cap
// is never shared across parallel projects.

const EMPTY = "You haven't registered any apps.";

/** Filter by text: on mobile the (closed) nav drawer is also a role="dialog". */
function confirmDialog(page: Page, title: string): Locator {
	return page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: title });
}

test.describe('J28 developer apps @p1', () => {
	let dev: ThrowawayUser | undefined;
	let appId: string | undefined;
	let context: BrowserContext | undefined;

	test.beforeEach(async () => {
		context = undefined;
		dev = undefined;
		appId = undefined;
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
		dev = await createVerifiedUser('OAuthDevUi');
	});

	test.afterEach(async () => {
		await context?.close();
		// Best-effort: the happy path already deleted it through the UI.
		if (dev && appId) {
			const api = await ApiClient.login(dev.email, dev.password).catch(() => undefined);
			if (api) await deleteApp(api, appId);
		}
	});

	test('register → client ID + badges → deactivate → delete → empty again', async ({
		browser,
		isMobile
	}) => {
		const page = await pageAs(browser, dev as ThrowawayUser);
		context = page.context();
		const name = uniqueName('DevUiApp');

		// Both entries are reachable from the account menu.
		await page.goto('/account/developer-apps');
		if (isMobile) {
			const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
			await expect(async () => {
				await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
				await expect(drawer).toBeInViewport({ timeout: 1_000 });
			}).toPass({ timeout: 15_000 });
			await expect(drawer.getByRole('link', { name: 'Connected apps' })).toBeVisible();
			await expect(drawer.getByRole('link', { name: 'Developer apps' })).toBeVisible();
			await drawer.getByRole('button', { name: 'Close menu' }).click();
		} else {
			await expect(async () => {
				await page.getByRole('button', { name: 'User menu' }).click();
				await expect(page.getByRole('menuitem', { name: 'Connected apps' })).toBeVisible({
					timeout: 1_000
				});
			}).toPass({ timeout: 15_000 });
			await expect(page.getByRole('menuitem', { name: 'Developer apps' })).toBeVisible();
			await page.keyboard.press('Escape');
		}

		// 1. Empty list.
		await expect(page.getByRole('heading', { level: 1, name: 'Developer apps' })).toBeVisible();
		await expect(page.getByText(EMPTY)).toBeVisible();

		// 2. Register a public app.
		await page.getByRole('link', { name: 'New app' }).first().click();
		await page.getByLabel('Name', { exact: true }).fill(name);
		await page.getByLabel('Redirect URI 1').fill(OAUTH_CALLBACK);
		await expect(page.getByRole('radio', { name: 'Public' })).toBeChecked();
		await page.getByRole('button', { name: 'Register app' }).click();
		await page.waitForURL(/\/account\/developer-apps\/[0-9a-f-]{36}$/);
		appId = new URL(page.url()).pathname.split('/').pop();

		// 3. Detail: client ID and status badges.
		await expect(page.getByRole('textbox', { name: 'Client ID' })).not.toHaveValue('');
		const badges = page.getByTestId('status-badge');
		await expect(badges.filter({ hasText: /^\s*Public\s*$/ })).toBeVisible();
		await expect(badges.filter({ hasText: /^\s*Active\s*$/ })).toBeVisible();

		// 4. Deactivate.
		await page.getByRole('button', { name: 'Deactivate' }).click();
		const deactivate = confirmDialog(page, `Deactivate ${name}?`);
		await expect(deactivate).toContainText('disconnected immediately');
		await deactivate.getByRole('button', { name: 'Deactivate' }).click();
		await expect(deactivate).toBeHidden();
		await expect(badges.filter({ hasText: /^\s*Inactive\s*$/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();

		// 5. Delete → back on the list, empty again.
		await page.getByRole('button', { name: 'Delete app' }).click();
		const del = confirmDialog(page, `Delete ${name}?`);
		await expect(del).toBeVisible();
		await del.getByRole('button', { name: 'Delete app' }).click();
		await page.waitForURL(/\/account\/developer-apps$/);
		await expect(page.getByText(EMPTY)).toBeVisible();
		appId = undefined;
	});
});
