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
	user: TestUser | { email: string; password: string },
	maxRetries = 3
): Promise<void> {
	const userData = typeof user === 'string' ? TEST_USERS[user] : user;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(userData.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(userData.password);
		await page.getByRole('button', { name: 'Sign in' }).click();

		try {
			// Wait for dashboard - shorter timeout per attempt
			await page.waitForURL('/dashboard', { timeout: 10000 });
			return; // Success!
		} catch {
			// Check if we're on login page with error (failed login)
			const currentUrl = page.url();
			if (currentUrl.includes('/login') && attempt < maxRetries) {
				// Login failed, retry
				continue;
			}
			if (attempt === maxRetries) {
				throw new Error(
					`Login failed after ${maxRetries} attempts. Current URL: ${currentUrl}`
				);
			}
		}
	}
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
