import { test as base, type Page } from '@playwright/test';

// Test users (from backend seed data)
export const TEST_USERS = {
	alice: {
		email: 'alice.owner@example.com',
		password: 'password123',
		firstName: 'Alice',
		lastName: 'Owner'
	},
	bob: {
		email: 'bob.member@example.com',
		password: 'password123',
		firstName: 'Bob',
		lastName: 'Member'
	},
	charlie: {
		email: 'charlie.guest@example.com',
		password: 'password123',
		firstName: 'Charlie',
		lastName: 'Guest'
	}
} as const;

export type TestUser = keyof typeof TEST_USERS;

// Extended test type with auth helpers
export type AuthFixtures = {
	loginAs: (user: TestUser) => Promise<void>;
	authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
	loginAs: async ({ page }, use) => {
		const login = async (user: TestUser) => {
			const userData = TEST_USERS[user];
			await page.goto('/login');
			await page.getByRole('textbox', { name: 'Email address' }).fill(userData.email);
			await page.getByRole('textbox', { name: 'Password' }).fill(userData.password);
			await page.getByRole('button', { name: 'Sign in' }).click();
			await page.waitForURL('/dashboard');
		};
		await use(login);
	},

	// Pre-authenticated page for tests that need it
	authenticatedPage: async ({ page }, use) => {
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.waitForURL('/dashboard');
		await use(page);
	}
});

export { expect } from '@playwright/test';
