import { expect, type Page, type Locator } from '@playwright/test';

export class ContactDialogPage {
	readonly page: Page;
	readonly contactButton: Locator;
	readonly dialog: Locator;
	readonly subjectInput: Locator;
	readonly messageInput: Locator;
	readonly sendButton: Locator;
	readonly successToast: Locator;
	readonly successHeading: Locator;

	constructor(page: Page, orgName: string) {
		this.page = page;
		this.contactButton = page.getByRole('button', { name: 'Contact organizer' });
		this.dialog = page.getByRole('dialog', { name: `Contact ${orgName}` });
		this.subjectInput = this.dialog.getByLabel(/Subject/);
		this.messageInput = this.dialog.getByLabel('Message');
		this.sendButton = this.dialog.getByRole('button', { name: 'Send message' });
		this.successToast = page.getByText('Your message has been sent.');
		this.successHeading = page.getByText('Message sent', { exact: true });
	}

	async open(): Promise<void> {
		await this.contactButton.click();
		await expect(this.dialog).toBeVisible();
	}

	async fillForm(subject: string, message: string): Promise<void> {
		await this.subjectInput.fill(subject);
		await this.messageInput.fill(message);
	}

	async submit(): Promise<void> {
		await this.sendButton.click();
	}

	async expectSuccess(): Promise<void> {
		await expect(this.successToast).toBeVisible();
		await expect(this.successHeading).toBeVisible();
	}
}
