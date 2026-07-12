import { expect, type Page, type Locator, type Response } from '@playwright/test';
import { gotoHydrated, waitForClientAuth } from '../navigation';

export class ReferralPage {
	readonly page: Page;
	readonly referralHeader: Locator;
	readonly referralCodeLabel: Locator;
	readonly payoutsHeader: Locator;
	readonly paidRow: Locator;
	readonly dialog: Locator;
	readonly dialogB2bText: Locator;
	readonly downloadPdfButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.referralHeader = page.getByRole('heading', { level: 1, name: 'Referral Program' });
		this.referralCodeLabel = page.getByText('Your referral code');
		this.payoutsHeader = page.getByRole('heading', { level: 1, name: 'Payout History' });
		this.paidRow = page.getByRole('row').filter({ hasText: 'Paid' }).first();
		this.dialog = page.getByRole('dialog', { name: 'Payout Statement' });
		this.dialogB2bText = this.dialog.getByText('Self-Billing Invoice (Gutschrift)');
		this.downloadPdfButton = this.dialog.getByRole('button', { name: 'Download PDF' });
	}

	async gotoReferral(): Promise<void> {
		await gotoHydrated(this.page, '/account/referral');
		await waitForClientAuth(this.page);
	}

	async expectReferralPage(code: string): Promise<void> {
		await expect(this.referralHeader).toBeVisible();
		await expect(this.referralCodeLabel).toBeVisible();
		await expect(this.page.getByText(code, { exact: true })).toBeVisible();
	}

	async gotoPayouts(): Promise<void> {
		await gotoHydrated(this.page, '/account/referral/payouts');
		await waitForClientAuth(this.page);
	}

	async expectPayoutsPage(): Promise<void> {
		await expect(this.payoutsHeader).toBeVisible();
	}

	async openPayoutStatement(): Promise<void> {
		await expect(this.paidRow).toBeVisible();
		await this.paidRow.getByRole('button', { name: 'View Statement' }).click();
		await expect(this.dialog).toBeVisible();
		await expect(this.dialogB2bText).toBeVisible();
	}

	async triggerPdfDownload(): Promise<Response> {
		const [downloadResponse] = await Promise.all([
			this.page.waitForResponse(
				(r) => r.url().includes('/statement/download') && r.request().method() === 'GET'
			),
			this.downloadPdfButton.click()
		]);
		return downloadResponse;
	}
}
