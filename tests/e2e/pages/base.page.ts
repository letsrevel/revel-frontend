import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
	constructor(protected readonly page: Page) {}

	// Common navigation elements
	get userMenuButton(): Locator {
		return this.page.getByRole('button', { name: 'User menu' });
	}

	get headerLogo(): Locator {
		return this.page.getByRole('link', { name: /revel/i });
	}

	// Common actions
	async waitForPageLoad(): Promise<void> {
		await this.page.waitForLoadState('networkidle');
	}

	async navigateTo(path: string): Promise<void> {
		await this.page.goto(path);
		await this.waitForPageLoad();
	}

	// Toast/Alert helpers
	async expectSuccessToast(text?: string | RegExp): Promise<void> {
		const alert = this.page.getByRole('status').first();
		await expect(alert).toBeVisible();
		if (text) {
			await expect(alert).toContainText(text);
		}
	}

	async expectErrorAlert(text?: string | RegExp): Promise<void> {
		const alert = this.page.getByRole('alert').first();
		await expect(alert).toBeVisible();
		if (text) {
			await expect(alert).toContainText(text);
		}
	}

	// Wait for navigation
	async waitForNavigation(urlPattern: string | RegExp): Promise<void> {
		await expect(this.page).toHaveURL(urlPattern);
	}
}
