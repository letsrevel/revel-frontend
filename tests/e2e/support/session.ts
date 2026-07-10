import type { BrowserContext, Page } from '@playwright/test';
import { obtainTokenPair } from './api';
import { PERSONAS, type PersonaName } from './personas';
import { gotoHydrated } from './navigation';
import { isDemoMode } from './skip';

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
 * Log in through the UI. On DEMO backends the login page REPLACES the
 * email/password form with a test-account dropdown as soon as the client
 * learns `demo: true` — filling the form races that swap, so pick the path
 * deterministically from the backend mode. (The dropdown only offers seeded
 * accounts; throwaway users need non-demo backends or authenticateContext.)
 */
export async function uiLogin(page: Page, who: PersonaName | Credentials): Promise<void> {
	const persona = typeof who === 'string' ? PERSONAS[who] : who;
	await gotoHydrated(page, '/login');
	if (await isDemoMode()) {
		const select = page.getByLabel('Select Test Account');
		await select.selectOption(persona.email);
		await page.getByRole('button', { name: /^Sign in as/ }).click();
	} else {
		await page.getByLabel('Email address').fill(persona.email);
		await page.getByLabel('Password', { exact: true }).fill(persona.password);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	}
	await page.waitForURL(/\/dashboard(\/|$|\?)/);
}
