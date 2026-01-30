import { test as base, expect, type Page } from '@playwright/test';

// Test users (from backend seed data - `make bootstrap`)
// See: revel-backend/src/events/management/commands/bootstrap_helpers/users.py
export const TEST_USERS = {
	// Organization Alpha
	alice: {
		email: 'alice.owner@example.com',
		password: 'password123',
		firstName: 'Alice',
		lastName: 'Owner',
		role: 'org_owner'
	},
	bob: {
		email: 'bob.staff@example.com',
		password: 'password123',
		firstName: 'Bob',
		lastName: 'Staff',
		role: 'org_staff'
	},
	charlie: {
		email: 'charlie.member@example.com',
		password: 'password123',
		firstName: 'Charlie',
		lastName: 'Member',
		role: 'org_member'
	},
	// Organization Beta
	diana: {
		email: 'diana.owner@example.com',
		password: 'password123',
		firstName: 'Diana',
		lastName: 'Owner',
		role: 'org_owner'
	},
	// Regular attendee
	george: {
		email: 'george.attendee@example.com',
		password: 'password123',
		firstName: 'George',
		lastName: 'Attendee',
		role: 'attendee'
	}
} as const;

export type TestUser = keyof typeof TEST_USERS;

/**
 * Standalone login helper - use this in tests that don't use the auth fixture
 * Has retry logic for reliability under load
 */
export async function loginAsUser(
	page: Page,
	user: TestUser | { email: string; password: string }
): Promise<void> {
	const userData = typeof user === 'string' ? TEST_USERS[user] : user;

	await page.goto('/login');
	await page.getByRole('textbox', { name: 'Email address' }).fill(userData.email);
	await page.getByRole('textbox', { name: 'Password' }).fill(userData.password);
	await page.getByRole('button', { name: 'Sign in' }).click();

	// Wait for dashboard with longer timeout - backend may be slow under load
	await page.waitForURL('/dashboard', { timeout: 20000 });
}

// Extended test type with auth helpers
export type AuthFixtures = {
	loginAs: (user: TestUser) => Promise<void>;
	authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
	loginAs: async ({ page }, use) => {
		const login = async (user: TestUser) => {
			await loginAsUser(page, user);
		};
		await use(login);
	},

	// Pre-authenticated page for tests that need it
	authenticatedPage: async ({ page }, use) => {
		await loginAsUser(page, 'alice');
		await use(page);
	}
});

export { expect };
