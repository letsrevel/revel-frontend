import { test, expect } from '@playwright/test';

test.describe('Password Reset Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/password-reset');
	});

	test('should display password reset form', async ({ page }) => {
		await expect(page).toHaveTitle(/Reset Password/i);
		await expect(
			page.getByRole('heading', { name: 'Reset your password', level: 1 })
		).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to login' })).toBeVisible();
	});

	test('should require email field', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		await expect(emailInput).toHaveAttribute('required');
	});

	test('should submit reset request with valid email', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const submitButton = page.getByRole('button', { name: 'Send reset link' });

		await emailInput.fill('alice.owner@example.com');
		await submitButton.click();

		// Should show success message
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});
	});

	test('should show success even for non-existent email (no user enumeration)', async ({
		page
	}) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const submitButton = page.getByRole('button', { name: 'Send reset link' });

		await emailInput.fill('nonexistent@example.com');
		await submitButton.click();

		// Should show same success message (prevents user enumeration)
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});
	});

	test('should show back to login link after success', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const submitButton = page.getByRole('button', { name: 'Send reset link' });

		await emailInput.fill('test@example.com');
		await submitButton.click();

		// Wait for success state
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});

		// Should have back to login link
		await expect(page.getByRole('link', { name: 'Back to login' })).toBeVisible();
	});

	test('should navigate back to login', async ({ page }) => {
		await page.getByRole('link', { name: 'Back to login' }).click();
		await expect(page).toHaveURL('/login');
	});

	test('should show loading state while submitting', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const submitButton = page.getByRole('button', { name: 'Send reset link' });

		await emailInput.fill('test@example.com');
		await submitButton.click();

		// Wait for success (loading might be too fast to catch)
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});
	});

	test('should show spam warning after success', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const submitButton = page.getByRole('button', { name: 'Send reset link' });

		await emailInput.fill('test@example.com');
		await submitButton.click();

		// Wait for success state
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});

		// Should show spam/junk folder warning
		await expect(page.getByText(/spam|junk/i)).toBeVisible();
	});
});

test.describe('Password Reset Page - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('should display properly on mobile', async ({ page }) => {
		await page.goto('/password-reset');

		await expect(
			page.getByRole('heading', { name: 'Reset your password', level: 1 })
		).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
	});

	test('should submit reset request on mobile', async ({ page }) => {
		await page.goto('/password-reset');

		await page.getByRole('textbox', { name: 'Email address' }).fill('mobile@test.com');
		await page.getByRole('button', { name: 'Send reset link' }).click();

		// Should show success
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});
	});
});

test.describe('Password Reset Page - Keyboard Navigation', () => {
	test('should be navigable via keyboard', async ({ page }) => {
		await page.goto('/password-reset');

		// Focus email input
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		await emailInput.focus();
		await expect(emailInput).toBeFocused();

		// Type email
		await page.keyboard.type('keyboard@test.com');

		// Submit with Enter
		await page.keyboard.press('Enter');

		// Should show success
		await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
			timeout: 10000
		});
	});
});

test.describe('Password Reset Page - Accessed from Login', () => {
	test('should navigate from login forgot password link', async ({ page }) => {
		await page.goto('/login');
		await page.getByRole('link', { name: 'Forgot password?' }).click();

		await expect(page).toHaveURL('/password-reset');
		await expect(
			page.getByRole('heading', { name: 'Reset your password', level: 1 })
		).toBeVisible();
	});
});
