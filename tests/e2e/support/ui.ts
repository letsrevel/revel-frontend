import type { Locator, Page } from '@playwright/test';

/**
 * Pick an option from a bits-ui Select (shadcn-svelte): the "select" is a
 * BUTTON trigger (aria-haspopup="listbox") that opens a floating listbox —
 * Playwright's selectOption() only works on native <select> elements.
 */
export async function pickSelectOption(
	page: Page,
	trigger: Locator,
	option: string | RegExp
): Promise<void> {
	await trigger.click();
	await page.getByRole('option', { name: option }).click();
}

/**
 * Close a bits-ui dialog via Escape — dialogs render TWO buttons named
 * "Close" (footer + the corner X), so a role-based click trips strict mode,
 * and the footer button is disabled while a mutation is in flight.
 */
export async function closeDialog(page: Page, dialog: Locator): Promise<void> {
	if (await dialog.isVisible()) {
		await page.keyboard.press('Escape');
	}
	await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
}
