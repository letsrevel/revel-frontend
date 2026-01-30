import { test, expect, TEST_USERS } from '../fixtures/auth.fixture';

test.describe('Logout', () => {
	test.beforeEach(async ({ page }) => {
		// Login first
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');
	});

	test('should logout via user menu', async ({ page }) => {
		// Open user menu
		await page.getByRole('button', { name: 'User menu' }).click();

		// Click logout
		await page.getByRole('menuitem', { name: 'Log Out' }).click();

		// Should redirect to home or login
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);
	});

	test('should clear session after logout', async ({ page }) => {
		// Open user menu and logout
		await page.getByRole('button', { name: 'User menu' }).click();
		await page.getByRole('menuitem', { name: 'Log Out' }).click();

		// Wait for redirect to home with logged_out param
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);

		// Navigate to a public page and verify user is logged out
		await page.goto('/events');

		// User menu should NOT be visible (indicates logged out)
		await expect(page.getByRole('button', { name: 'User menu' })).not.toBeVisible();

		// Login link should be visible (unauthenticated state)
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
	});

	test('should not show user menu after logout', async ({ page }) => {
		// Logout
		await page.getByRole('button', { name: 'User menu' }).click();
		await page.getByRole('menuitem', { name: 'Log Out' }).click();

		// Wait for redirect
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);

		// Navigate to public page
		await page.goto('/events');

		// User menu should not be visible (not logged in)
		await expect(page.getByRole('button', { name: 'User menu' })).not.toBeVisible();
	});

	test('should show unauthenticated state when accessing pages after logout', async ({ page }) => {
		// Logout
		await page.getByRole('button', { name: 'User menu' }).click();
		await page.getByRole('menuitem', { name: 'Log Out' }).click();
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);

		// Navigate to dashboard - app shows unauthenticated state (empty queries)
		// rather than redirecting to login
		await page.goto('/dashboard');

		// Verify user is not authenticated by checking UI state
		// User menu should NOT be visible
		await expect(page.getByRole('button', { name: 'User menu' })).not.toBeVisible();

		// Login link should be visible
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
	});
});

test.describe('Logout - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('should logout on mobile', async ({ page }) => {
		// Login
		await page.goto('/login');

		// Fill login form - the form should be visible even with mobile menu
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');

		// On mobile, open the hamburger menu
		const hamburgerButton = page.getByRole('button', { name: 'Toggle navigation menu' });
		await expect(hamburgerButton).toBeVisible({ timeout: 10000 });
		await hamburgerButton.click();

		// Wait for mobile navigation dialog to open
		await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();

		// Find the logout button - it's at the bottom of the scrollable mobile nav
		const logoutButton = page.getByRole('button', { name: 'Log Out' });

		// The mobile nav is a fixed drawer with scrollable content
		// Use JavaScript to scroll and click since Playwright struggles with this layout
		await logoutButton.evaluate((el) => {
			// Scroll into view first
			el.scrollIntoView({ behavior: 'instant', block: 'center' });
			// Then click via JavaScript
			(el as HTMLButtonElement).click();
		});

		// Should redirect
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);
	});
});

test.describe('Direct Logout Route', () => {
	test('should handle direct navigation to /logout', async ({ page }) => {
		// Login first
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');

		// Navigate directly to logout
		await page.goto('/logout');

		// Should redirect after logout
		await expect(page).toHaveURL(/\/(\?logged_out=true)?$|\/login/);

		// Verify session is cleared by checking UI state
		await page.goto('/events');

		// User menu should NOT be visible (logged out)
		await expect(page.getByRole('button', { name: 'User menu' })).not.toBeVisible();

		// Login link should be visible
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
	});

	test('should handle /logout when not logged in', async ({ page }) => {
		// Navigate to logout without being logged in
		await page.goto('/logout');

		// Should redirect to login or home (not error)
		await expect(page).not.toHaveURL(/error|500/);
	});
});
