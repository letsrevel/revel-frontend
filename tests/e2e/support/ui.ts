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

/**
 * Accept the shared in-app confirmation dialog (`common/ConfirmDialog`), which
 * replaced every native `window.confirm()` (#1193). Matches the confirm button
 * by test id so the helper is independent of its per-flow label ("Confirm",
 * "Delete", "Remove"). Returns the dialog's text so callers can assert on the
 * message the old `dialog.message()` handlers used to capture.
 */
export async function confirmInApp(page: Page): Promise<string> {
	const dialog = page.getByTestId('confirm-dialog');
	await dialog.waitFor({ state: 'visible', timeout: 10_000 });
	const text = (await dialog.innerText()).trim();
	await dialog.getByTestId('confirm-dialog-confirm').click();
	await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
	return text;
}

/**
 * Dismiss the shared in-app confirmation dialog with its Cancel button and
 * return its text (the in-app counterpart of `dialog.dismiss()`).
 */
export async function cancelInApp(page: Page): Promise<string> {
	const dialog = page.getByTestId('confirm-dialog');
	await dialog.waitFor({ state: 'visible', timeout: 10_000 });
	const text = (await dialog.innerText()).trim();
	await dialog.getByTestId('confirm-dialog-cancel').click();
	await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
	return text;
}
