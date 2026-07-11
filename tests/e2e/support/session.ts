import { expect, type BrowserContext, type Page } from '@playwright/test';
import { obtainTokenPair } from './api';
import { PERSONAS, type PersonaName } from './personas';
import { gotoHydrated } from './navigation';
import { isDemoMode } from './skip';
import { revealLoginForm } from './auth-forms';

/**
 * Authenticate a browser context as a persona by planting a FRESH token pair
 * as the app's auth cookies. See fixtures.ts for why sessions are never
 * shared between contexts (refresh rotation + blacklist).
 *
 * Prefer the persona fixtures (`asOwner`, …); use this directly when a spec
 * needs to pick the persona dynamically (e.g. a different user per project so
 * parallel desktop/mobile runs don't mutate the same seeded state).
 */

const APP_HOST = 'localhost';

function authCookie(name: string, value: string) {
	return {
		name,
		value,
		domain: APP_HOST,
		path: '/',
		expires: Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7,
		httpOnly: true,
		secure: false,
		sameSite: 'Lax' as const
	};
}

export interface Credentials {
	email: string;
	password: string;
}

export async function authenticateContext(
	context: BrowserContext,
	who: PersonaName | Credentials
): Promise<void> {
	const persona = typeof who === 'string' ? PERSONAS[who] : who;
	const { access, refresh } = await obtainTokenPair(persona.email, persona.password);
	await context.addCookies([
		authCookie('access_token', access),
		authCookie('refresh_token', refresh),
		// 'true' → hooks.server.ts refreshes with persistent cookie options.
		authCookie('remember_me', 'true')
	]);
}

/**
 * Log in through the UI. On DEMO backends the login page defaults to the
 * test-account dropdown (SSR-decided, #600). Persona NAMES map to seeded
 * accounts, so they take the dropdown path. Raw CREDENTIALS (a throwaway user
 * with no dropdown entry) instead reveal the real email/password form via the
 * "Show login form" toggle and sign in with it. Non-demo backends always use
 * the password form directly.
 */
export async function uiLogin(page: Page, who: PersonaName | Credentials): Promise<void> {
	const persona = typeof who === 'string' ? PERSONAS[who] : who;
	await gotoHydrated(page, '/login');
	const demo = await isDemoMode();
	if (demo && typeof who === 'string') {
		const select = page.getByLabel('Select Test Account');
		await select.selectOption(persona.email);
		await page.getByRole('button', { name: /^Sign in as/ }).click();
	} else {
		if (demo) await revealLoginForm(page);
		// Outcome-keyed re-fill: the form-reveal focus handoff (and any other
		// late focus/hydration race) can spray a fill into the wrong field —
		// re-fill until the rendered values prove both landed, then submit.
		const emailInput = page.getByLabel('Email address');
		const passwordInput = page.getByLabel('Password', { exact: true });
		await expect(async () => {
			await emailInput.fill(persona.email);
			await passwordInput.fill(persona.password);
			await expect(emailInput).toHaveValue(persona.email, { timeout: 2_000 });
			await expect(passwordInput).toHaveValue(persona.password, { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	}
	await page.waitForURL(/\/dashboard(\/|$|\?)/);
}
