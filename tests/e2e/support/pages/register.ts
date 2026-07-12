import { expect, type Page, type Locator } from '@playwright/test';
import { gotoHydrated } from '../navigation';
import { revealRegistrationForm } from '../auth-forms';

export class RegisterPage {
	readonly page: Page;
	readonly emailInput: Locator;
	readonly passwordInput: Locator;
	readonly confirmInput: Locator;
	readonly termsCheckbox: Locator;
	readonly submitButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.emailInput = page.getByLabel('Email address');
		this.passwordInput = page.getByLabel('Password', { exact: true });
		this.confirmInput = page.getByLabel('Confirm password');
		this.termsCheckbox = page.getByLabel(/I accept the/);
		this.submitButton = page.getByRole('button', { name: 'Create your account' });
	}

	async goto(refCode?: string): Promise<void> {
		const path = refCode ? `/register?ref=${refCode}` : '/register';
		await gotoHydrated(this.page, path);
		await revealRegistrationForm(this.page);
	}

	async confirmReferralCode(code: string): Promise<void> {
		await expect(this.page.getByText('Referral code applied')).toBeVisible();
		await expect(this.page.getByText(code, { exact: true })).toBeVisible();
	}

	async fillForm(email: string, password: string): Promise<void> {
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		await this.confirmInput.fill(password);
		await this.termsCheckbox.check();
	}

	async expectSubmitEnabled(): Promise<void> {
		await expect(this.submitButton).toBeEnabled();
	}

	async submit(): Promise<void> {
		await this.submitButton.click();
	}
}
