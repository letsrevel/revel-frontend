import { expect, type Page } from '@playwright/test';
import { isDemoMode } from './skip';
import { gotoHydrated } from './navigation';

/**
 * Reach the real login / registration forms on DEMO_MODE backends (#600).
 *
 * On demo instances the auth surfaces default to the demo-account path: /login
 * shows the test-account dropdown, /register gates the form behind a nudge
 * overlay. Both are SSR-decided (no hydration-time swap) and only change on an
 * explicit user click. These helpers perform that click when — and only when —
 * the backend is in demo mode; against a non-demo backend they are no-ops, so
 * specs can call them unconditionally. The page must already be on the relevant
 * route and hydrated (see gotoHydrated).
 */

export async function revealLoginForm(page: Page): Promise<void> {
	if (await isDemoMode()) {
		// Under parallel load the backend /version call behind SSR demo
		// detection can transiently fail and the page falls open to the plain
		// form — then there is no toggle to click. Don't hang on it: if the
		// toggle isn't there, the form already is.
		try {
			await page.getByRole('button', { name: 'Show login form' }).click({ timeout: 10_000 });
		} catch {
			await page.getByLabel('Email address').waitFor({ timeout: 5_000 });
		}
	}
}

export async function revealRegistrationForm(page: Page): Promise<void> {
	if (await isDemoMode()) {
		// Same fail-open tolerance as revealLoginForm (see above).
		try {
			await page.getByRole('button', { name: 'Register anyway' }).click({ timeout: 10_000 });
		} catch {
			await page.getByLabel('Email address').waitFor({ timeout: 5_000 });
		}
	}
}

/**
 * Navigate to /register and fill the registration form, leaving it ready to
 * submit (shared by the j02 registration journeys).
 *
 * Outcome-keyed fill loop (same medicine as the questionnaire builder's
 * Tiptap re-fill): a fill landing in the hydration-settling window can update
 * the DOM without Svelte's $state ever learning about it, so the submit
 * button (disabled on $state-derived canSubmit) never enables. Re-fill until
 * the RENDERED state proves the values landed: the button enables (strong
 * path) or the strength panel appears (weak path — it renders only when the
 * password $state is non-empty). fill() replaces the whole value, so a retry
 * also repairs a corrupted field.
 */
export async function fillRegistrationForm(
	page: Page,
	email: string,
	password: string,
	{ expectSubmittable = true }: { expectSubmittable?: boolean } = {}
): Promise<void> {
	await gotoHydrated(page, '/register');
	await revealRegistrationForm(page);

	const emailInput = page.getByLabel('Email address');
	const passwordInput = page.getByLabel('Password', { exact: true });
	const confirmInput = page.getByLabel('Confirm password');
	const terms = page.getByLabel(/I accept the/);
	const submit = page.getByRole('button', { name: 'Create your account' });

	await expect(async () => {
		await emailInput.fill(email);
		await passwordInput.fill(password);
		await confirmInput.fill(password);
		if (!(await terms.isChecked())) await terms.check();
		await expect(emailInput).toHaveValue(email, { timeout: 2_000 });
		if (expectSubmittable) {
			await expect(submit).toBeEnabled({ timeout: 2_000 });
		} else {
			await expect(passwordInput).toHaveValue(password, { timeout: 2_000 });
			await expect(page.getByText('Password strength:')).toBeVisible({ timeout: 2_000 });
		}
	}).toPass({ timeout: 45_000 });
}
