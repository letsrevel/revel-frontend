import { test, expect, type Page } from '@playwright/test';

// Polls admin smoke (Task 14 of the polls-ui plan).
//
// Prerequisites
// -------------
// 1. Local Revel backend in demo mode (Alice Owner as owner of "Revel Events
//    Collective"; see `revel-backend/src/events/management/commands/README.md`).
// 2. This Playwright project's webServer pointed at the same backend via
//    `PUBLIC_API_URL`.
//
// What this smoke covers
// ----------------------
// - Admin can land on the new /admin/polls page.
// - Admin can create a minimal poll (one MC question, two options).
// - The freshly-created poll lands on the detail page.
// - Admin can click "Open poll" from the status bar.
// - The voter URL strip appears after opening.
// - The Copy button writes the voter URL to the clipboard.
//
// Skips itself when the demo backend isn't reachable (no demo-account select).

const ORG_SLUG = 'revel-events-collective';
const ALICE_EMAIL = 'alice.owner@example.com';

async function loginAsAliceOwner(page: Page): Promise<void> {
	await page.goto('/login', { timeout: 90_000 });

	const demoSelect = page.locator('#demo-account');
	try {
		await demoSelect.waitFor({ state: 'visible', timeout: 20_000 });
	} catch {
		test.skip(true, 'demo backend not reachable — set PUBLIC_API_URL to a demo-mode Revel backend');
	}

	await demoSelect.selectOption(ALICE_EMAIL);
	await page.getByRole('button', { name: /^sign in as/i }).click();
	await page.waitForURL(/\/dashboard(\/|$|\?)|\/org\//, { timeout: 20_000 });
}

test.describe('polls admin', () => {
	test('create → open → copy share link', async ({ page, context, browserName }) => {
		// WebKit's clipboard permissions are flaky in headless CI. Restrict to chromium.
		test.skip(browserName !== 'chromium', 'clipboard assertions require chromium');

		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		await loginAsAliceOwner(page);

		await page.goto(`/org/${ORG_SLUG}/admin/polls/new`);

		// Wait for hydration to finish before any interaction. The MC question-
		// type picker is rendered server-side, but its click handler is wired up
		// during hydration — clicking too early no-ops silently (the click lands,
		// the button goes :active, but no question is added).
		await page.waitForLoadState('networkidle');

		const name = `Polls smoke ${Date.now()}`;
		await page.getByLabel(/poll name/i).fill(name);

		// Add a multiple-choice question. The card has two "Multiple Choice"
		// buttons (top + bottom of the questions card) — picking the first works.
		// Assert the question count flips from "(0)" to "(1)" before continuing,
		// so a swallowed pre-hydration click fails here instead of timing out on
		// the question textbox that never appears.
		await page
			.getByRole('button', { name: /multiple choice/i })
			.first()
			.click();
		await expect(page.getByRole('heading', { name: /questions \(1\)/i })).toBeVisible({
			timeout: 10_000
		});

		// Fill in the question text and two options. The question editor renders
		// a question input and "Add option" affordance — match by visible role/label.
		const questionInput = page.getByRole('textbox', { name: /question/i }).first();
		await questionInput.fill('Smoke option?');

		// Fill the first two option inputs the editor pre-renders.
		const optionInputs = page.getByRole('textbox', { name: /option/i });
		await optionInputs.nth(0).fill('A');
		await optionInputs.nth(1).fill('B');

		await page.getByRole('button', { name: /^create poll$/i }).click();

		// Lands on detail page at /org/{slug}/admin/polls/{uuid}.
		await page.waitForURL(/\/admin\/polls\/[0-9a-f-]+/, { timeout: 30_000 });

		// Open the poll via the status-bar primary button.
		await page.getByRole('button', { name: /^open poll$/i }).click();

		// URL strip should now be visible. The copy button reads the localized
		// "Copy link" string from messages.
		const copyButton = page.getByRole('button', { name: /copy link/i });
		await expect(copyButton).toBeVisible({ timeout: 10_000 });

		await copyButton.click();
		const clip = await page.evaluate(() => navigator.clipboard.readText());
		expect(clip).toMatch(new RegExp(`/org/${ORG_SLUG}/polls/[0-9a-f-]+`));
	});
});
