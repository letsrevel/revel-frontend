import type { Page } from '@playwright/test';
import { fetchWithRetry } from './api';

/**
 * E2E Keycloak (backend PR #920): realm `revel` on the compose overlay,
 * started by `make e2e-setup`. Seeded users share the bootstrap password;
 * per-run throwaway users go through the admin REST API.
 */
const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8080';
const REALM = 'revel';
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'admin';

export const KEYCLOAK_PASSWORD = 'password123';

/** Fill Keycloak's standard login theme and submit. */
export async function loginAtKeycloak(
	page: Page,
	email: string,
	password: string = KEYCLOAK_PASSWORD
): Promise<void> {
	await page.locator('#username').fill(email);
	await page.locator('#password').fill(password);
	await page.locator('#kc-login').click();
}

/**
 * fetchWithRetry plus a bounded retry on transient NETWORK failures. Keycloak
 * runs CPU-capped in the compose overlay and drops idle keep-alive sockets
 * under parallel-worker load, which surfaces in Node as
 * `TypeError: fetch failed … SocketError: other side closed` — an exception,
 * not a 5xx, so fetchWithRetry's own guard doesn't outlast it.
 */
async function keycloakFetch(url: string, init: RequestInit): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= 4; attempt++) {
		try {
			return await fetchWithRetry(url, init);
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
	throw lastError;
}

async function adminToken(): Promise<string> {
	const response = await keycloakFetch(
		`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: 'admin-cli',
				grant_type: 'password',
				username: ADMIN_USER,
				password: ADMIN_PASSWORD
			}).toString()
		}
	);
	if (!response.ok) {
		throw new Error(`Keycloak admin token failed: ${response.status}`);
	}
	return ((await response.json()) as { access_token: string }).access_token;
}

/** Create a throwaway realm user (password = KEYCLOAK_PASSWORD). */
export async function createKeycloakUser({
	email,
	emailVerified = true
}: {
	email: string;
	emailVerified?: boolean;
}): Promise<{ email: string; password: string }> {
	const token = await adminToken();
	const response = await keycloakFetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({
			username: email,
			email,
			emailVerified,
			enabled: true,
			firstName: 'E2E',
			lastName: 'Keycloak',
			credentials: [{ type: 'password', value: KEYCLOAK_PASSWORD, temporary: false }]
		})
	});
	if (response.status !== 201) {
		throw new Error(`Keycloak user create failed: ${response.status} ${await response.text()}`);
	}
	return { email, password: KEYCLOAK_PASSWORD };
}
