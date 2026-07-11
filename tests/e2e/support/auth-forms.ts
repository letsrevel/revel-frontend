import type { Page } from '@playwright/test';
import { isDemoMode } from './skip';

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
