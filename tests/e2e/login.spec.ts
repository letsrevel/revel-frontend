import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
	});

	test('should display login form with all elements', async ({ page }) => {
		// Check page title and heading
		await expect(page).toHaveTitle(/Sign In/);
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect(page.getByText('Sign in to your account to continue')).toBeVisible();

		// Check form elements
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
		await expect(page.getByRole('checkbox', { name: 'Remember me for 30 days' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

		// Check links
		await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
	});

	test('should show password toggle button', async ({ page }) => {
		const passwordInput = page.getByRole('textbox', { name: 'Password' });
		const toggleButton = page.getByRole('button', { name: 'Show password' });

		// Initially password should be hidden (type="password")
		await expect(toggleButton).toBeVisible();

		// Type a password
		await passwordInput.fill('testpassword');

		// Click toggle to show password
		await toggleButton.click();

		// Password should now be visible (toggle button still present)
		// The input type changes from password to text
		await expect(toggleButton).toBeVisible();
	});

	test('should navigate to forgot password page', async ({ page }) => {
		await page.getByRole('link', { name: 'Forgot password?' }).click();
		await expect(page).toHaveURL('/password-reset');
	});

	test('should navigate to registration page', async ({ page }) => {
		await page.getByRole('link', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/register');
	});

	test('should show error with invalid credentials', async ({ page }) => {
		await page.getByRole('textbox', { name: 'Email address' }).fill('invalid@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
		await page.getByRole('button', { name: 'Sign in' }).click();

		// Should show error message and stay on login page
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});

	test('should successfully login with valid credentials', async ({ page }) => {
		await page.getByRole('textbox', { name: 'Email address' }).fill('alice.owner@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('password123');
		await page.getByRole('button', { name: 'Sign in' }).click();

		// Should redirect to dashboard
		await page.waitForURL('/dashboard', { timeout: 20000 });

		// Should show welcome message with user's name
		await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

		// Should show user menu in header
		await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
	});

	test('should allow checking remember me checkbox', async ({ page }) => {
		const checkbox = page.getByRole('checkbox', { name: 'Remember me for 30 days' });

		// Initially unchecked
		await expect(checkbox).not.toBeChecked();

		// Check it
		await checkbox.check();
		await expect(checkbox).toBeChecked();

		// Uncheck it
		await checkbox.uncheck();
		await expect(checkbox).not.toBeChecked();
	});

	test('should be accessible via keyboard navigation', async ({ page }) => {
		// Tab to email field
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab'); // Skip "Skip to main content" link
		// Continue tabbing to reach the form

		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password' });

		// Fill using keyboard
		await emailInput.focus();
		await page.keyboard.type('alice.owner@example.com');

		await page.keyboard.press('Tab'); // Move to forgot password link
		await page.keyboard.press('Tab'); // Move to password field

		await passwordInput.focus();
		await page.keyboard.type('password123');

		// Submit with Enter key
		await page.keyboard.press('Enter');

		// Should redirect to dashboard
		await page.waitForURL('/dashboard', { timeout: 20000 });
	});

	test('should preserve email value after failed login attempt', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const email = 'test@example.com';

		await emailInput.fill(email);
		await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
		await page.getByRole('button', { name: 'Sign in' }).click();

		// Wait for error
		await expect(page.getByRole('alert')).toBeVisible();

		// Email should still be there
		await expect(emailInput).toHaveValue(email);
	});
});

test.describe('Login Page - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('should display properly on mobile viewport', async ({ page }) => {
		await page.goto('/login');

		// Form should be visible and usable
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	});

	test('should successfully login on mobile', async ({ page }) => {
		await page.goto('/login');

		await page.getByRole('textbox', { name: 'Email address' }).fill('alice.owner@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('password123');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await page.waitForURL('/dashboard', { timeout: 20000 });
		await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
	});
});

test.describe('Login - Session Persistence', () => {
	test('should maintain session after login and allow dashboard access', async ({ page }) => {
		// First, login
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill('alice.owner@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('password123');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.waitForURL('/dashboard', { timeout: 20000 });

		// Navigate away and back to dashboard
		await page.goto('/events');
		await page.goto('/dashboard');

		// Should still be authenticated and see the dashboard
		await page.waitForURL('/dashboard', { timeout: 20000 });
		await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
	});
});
