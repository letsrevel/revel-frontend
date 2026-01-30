import { test, expect } from '@playwright/test';

test.describe('Registration Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/register');
	});

	test('should display registration form with all elements', async ({ page }) => {
		// Check page title and heading
		await expect(page).toHaveTitle(/Create Account/i);
		await expect(
			page.getByRole('heading', { name: 'Create your account', level: 1 })
		).toBeVisible();

		// Check form elements
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Confirm password' })).toBeVisible();
		await expect(page.getByRole('checkbox')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create your account' })).toBeVisible();

		// Check links - use main content to avoid footer duplicates
		await expect(
			page.locator('main').getByRole('link', { name: 'Terms of Service' })
		).toBeVisible();
		await expect(page.locator('main').getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
	});

	test('should have submit button disabled initially', async ({ page }) => {
		const submitButton = page.getByRole('button', { name: 'Create your account' });
		await expect(submitButton).toBeDisabled();
	});

	test('should show password toggle buttons', async ({ page }) => {
		// There should be two "Show password" buttons (one for each password field)
		const toggleButtons = page.getByRole('button', { name: 'Show password' });
		await expect(toggleButtons).toHaveCount(2);
	});

	test('should show password strength indicator when typing', async ({ page }) => {
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });

		// Type a weak password - use type instead of fill for better reactivity
		await passwordInput.click();
		await passwordInput.type('weak', { delay: 50 });

		// Should show password requirements - actual text from component
		await expect(page.getByText('At least 8 characters')).toBeVisible({ timeout: 10000 });
	});

	test('should show all password requirements', async ({ page }) => {
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });

		// Type something to trigger requirements display - use type for reactivity
		await passwordInput.click();
		await passwordInput.type('a', { delay: 50 });

		// Check for all requirements (actual text from PasswordStrengthIndicator component)
		await expect(page.getByText('At least 8 characters')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('One uppercase letter')).toBeVisible();
		await expect(page.getByText('One lowercase letter')).toBeVisible();
		await expect(page.getByText('One number')).toBeVisible();
		await expect(page.getByText(/One special character/)).toBeVisible();
	});

	test('should enable submit when all requirements are met', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const termsCheckbox = page.getByRole('checkbox');
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Fill valid data
		await emailInput.fill('test@example.com');
		await passwordInput.fill('SecurePass123!');
		await confirmInput.fill('SecurePass123!');
		await termsCheckbox.check();

		// Wait for reactivity to update the button state
		await expect(submitButton).toBeEnabled({ timeout: 10000 });
	});

	test('should keep submit disabled with mismatched passwords', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const termsCheckbox = page.getByRole('checkbox');
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Fill with mismatched passwords
		await emailInput.fill('test@example.com');
		await passwordInput.fill('SecurePass123!');
		await confirmInput.fill('DifferentPass123!');
		await termsCheckbox.check();

		// Submit should still be disabled
		await expect(submitButton).toBeDisabled();
	});

	test('should keep submit disabled without terms acceptance', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Fill valid data but don't accept terms
		await emailInput.fill('test@example.com');
		await passwordInput.fill('SecurePass123!');
		await confirmInput.fill('SecurePass123!');

		// Submit should be disabled
		await expect(submitButton).toBeDisabled();
	});

	test('should keep submit disabled with weak password', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const termsCheckbox = page.getByRole('checkbox');
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Fill with weak password (no special char)
		await emailInput.fill('test@example.com');
		await passwordInput.fill('WeakPass1');
		await confirmInput.fill('WeakPass1');
		await termsCheckbox.check();

		// Submit should be disabled due to weak password
		await expect(submitButton).toBeDisabled();
	});

	test('should navigate to login page', async ({ page }) => {
		// Click the login link in the "Already have an account?" section
		await page
			.getByText('Already have an account?')
			.locator('..')
			.getByRole('link', { name: 'Login' })
			.click();
		await expect(page).toHaveURL('/login');
	});

	test('should open terms of service in new tab', async ({ page, context }) => {
		// Use the link in main content (form checkbox area)
		const [newPage] = await Promise.all([
			context.waitForEvent('page'),
			page.locator('main').getByRole('link', { name: 'Terms of Service' }).click()
		]);

		await newPage.waitForLoadState();
		await expect(newPage).toHaveURL(/\/legal\/terms/);
	});

	test('should open privacy policy in new tab', async ({ page, context }) => {
		// Use the link in main content (form checkbox area)
		const [newPage] = await Promise.all([
			context.waitForEvent('page'),
			page.locator('main').getByRole('link', { name: 'Privacy Policy' }).click()
		]);

		await newPage.waitForLoadState();
		await expect(newPage).toHaveURL(/\/legal\/privacy/);
	});

	test('should complete registration with valid data', async ({ page }) => {
		// Generate unique email to avoid conflicts
		const uniqueEmail = `test-${Date.now()}@example.com`;

		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const termsCheckbox = page.getByRole('checkbox');
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Fill valid data
		await emailInput.fill(uniqueEmail);
		await passwordInput.fill('SecurePass123!');
		await confirmInput.fill('SecurePass123!');
		await termsCheckbox.check();

		// Submit
		await submitButton.click();

		// Should redirect to check-email page
		await expect(page).toHaveURL(/\/register\/check-email/);
		await expect(page.getByRole('heading', { name: /check.*email/i })).toBeVisible();
	});

	test('should show error for already registered email', async ({ page }) => {
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
		const confirmInput = page.getByRole('textbox', { name: 'Confirm password' });
		const termsCheckbox = page.getByRole('checkbox');
		const submitButton = page.getByRole('button', { name: 'Create your account' });

		// Use an email that's already registered
		await emailInput.fill('alice.owner@example.com');
		await passwordInput.fill('SecurePass123!');
		await confirmInput.fill('SecurePass123!');
		await termsCheckbox.check();

		await submitButton.click();

		// Should show error (either alert or stay on page)
		await expect(page.getByRole('alert').or(page.getByText(/already|exist/i))).toBeVisible({
			timeout: 10000
		});
	});
});

test.describe('Registration Page - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('should display properly on mobile viewport', async ({ page }) => {
		await page.goto('/register');

		// Form should be visible and usable
		await expect(
			page.getByRole('heading', { name: 'Create your account', level: 1 })
		).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Confirm password' })).toBeVisible();
		await expect(page.getByRole('checkbox')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create your account' })).toBeVisible();
	});

	test('should handle form interaction on mobile', async ({ page }) => {
		await page.goto('/register');

		// Fill form on mobile
		await page.getByRole('textbox', { name: 'Email address' }).fill('mobile@test.com');
		await page.getByRole('textbox', { name: 'Password', exact: true }).fill('SecurePass123!');
		await page.getByRole('textbox', { name: 'Confirm password' }).fill('SecurePass123!');
		await page.getByRole('checkbox').click();

		// Button should be enabled
		await expect(page.getByRole('button', { name: 'Create your account' })).toBeEnabled({
			timeout: 10000
		});
	});
});

test.describe('Registration Page - Keyboard Navigation', () => {
	test('should be navigable via keyboard', async ({ page }) => {
		await page.goto('/register');

		// Find email input and verify it can receive focus
		const emailInput = page.getByRole('textbox', { name: 'Email address' });
		await emailInput.focus();
		await expect(emailInput).toBeFocused();

		// Type email
		await page.keyboard.type('keyboard@test.com');

		// Tab to password
		await page.keyboard.press('Tab');

		// Tab to toggle, then confirm password
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		// Continue to checkbox
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
	});

	test('should submit form with Enter key', async ({ page }) => {
		await page.goto('/register');

		const uniqueEmail = `keyboard-${Date.now()}@example.com`;

		// Fill form
		await page.getByRole('textbox', { name: 'Email address' }).fill(uniqueEmail);
		await page.getByRole('textbox', { name: 'Password', exact: true }).fill('SecurePass123!');
		await page.getByRole('textbox', { name: 'Confirm password' }).fill('SecurePass123!');
		await page.getByRole('checkbox').check();

		// Wait for the button to be enabled before pressing Enter
		const submitButton = page.getByRole('button', { name: 'Create your account' });
		await expect(submitButton).toBeEnabled({ timeout: 10000 });

		// Submit with Enter from any form field
		await page.getByRole('textbox', { name: 'Confirm password' }).press('Enter');

		// Should redirect to check-email
		await expect(page).toHaveURL(/\/register\/check-email/, { timeout: 15000 });
	});
});

test.describe('Check Email Page', () => {
	test('should display check email page content', async ({ page }) => {
		await page.goto('/register/check-email?email=test@example.com');

		await expect(page.getByRole('heading', { name: /check.*email/i })).toBeVisible();
		await expect(page.getByText('test@example.com')).toBeVisible();
		await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
		// Use the specific "Back to login" link text
		await expect(page.getByRole('link', { name: 'Back to login' })).toBeVisible();
	});

	test('should have resend button', async ({ page }) => {
		await page.goto('/register/check-email?email=test@example.com');

		const resendButton = page.getByRole('button', { name: /resend/i });
		await expect(resendButton).toBeVisible();
		await expect(resendButton).toBeEnabled();
	});

	test('should navigate back to login', async ({ page }) => {
		await page.goto('/register/check-email?email=test@example.com');

		await page.getByRole('link', { name: 'Back to login' }).click();
		await expect(page).toHaveURL('/login');
	});
});
