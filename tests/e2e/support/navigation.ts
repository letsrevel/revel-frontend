import type { Page } from '@playwright/test';

/**
 * Navigate and wait for the app to be HYDRATED before returning.
 *
 * SvelteKit serves interactive-looking SSR HTML, but clicks/fills dispatched
 * before hydration are silently lost (buttons have no listeners yet, inputs
 * have no bindings). The root layout stamps `data-hydrated` on <body> in
 * onMount (see src/routes/+layout.svelte); waiting for it removes the whole
 * class of "clicked too early, nothing happened" flakes.
 *
 * Use this instead of page.goto() in every journey spec that interacts with
 * the page. Plain page.goto() is fine for read-only assertions on SSR content.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
	// Best-effort settle: interactions during the initial query burst can land
	// on components that immediately re-render (dropping clicks/fills). Bounded
	// so a polling endpoint can never hang navigation.
	await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

/**
 * Wait until the CLIENT auth store finished bootstrapping (async token
 * refresh after hydration). The notifications bell renders only once the
 * in-memory access token exists, so it doubles as the readiness signal.
 *
 * Required before client-side MUTATIONS (claims, RSVPs, admin saves): a
 * mutation fired during bootstrap goes out without an Authorization header
 * and surfaces as "Unauthorized" in the UI.
 */
export async function waitForClientAuth(page: Page): Promise<void> {
	const bell = page.getByRole('button', { name: 'Open notifications' });
	try {
		await bell.waitFor({ timeout: 15_000 });
	} catch {
		// Bootstrap stalled (slow backend or a lost refresh race) — a reload
		// re-runs it against the CURRENT cookies and self-heals.
		await page.reload();
		await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
		await bell.waitFor({ timeout: 20_000 });
	}
}
