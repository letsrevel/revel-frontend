import { test, expect, type Page } from '@playwright/test';

// Polls voter happy-path smoke.
//
// Why this exists
// ---------------
// The PollVoteForm regressed silently when the poll-detail endpoint started
// embedding `QuestionnaireResponseSchema` (Django reverse-relation field
// names like `multiplechoicequestion_questions`) instead of the
// `QuestionnaireSchema` everything else uses. The frontend's shared
// `flattenQuestionnaire` is typed for the latter; structurally-optional
// fields meant TypeScript didn't catch the mismatch, and the form rendered
// with zero options. A type check + admin-side smoke both passed.
//
// This test goes through the actual voter flow end-to-end and asserts the
// vote was recorded, which would have caught that regression on day one.
//
// Prerequisites
// -------------
// 1. Local Revel backend in demo mode with the default seed data
//    (Alice Owner + Charlie Member of "Revel Events Collective").
// 2. Playwright's webServer pointed at the same backend via PUBLIC_API_URL.
//
// What this covers
// ----------------
// - Admin (Alice) creates a poll with one MC question + two options.
// - Admin opens the poll.
// - Voter (Charlie) lands on the voter URL.
// - The question text and both options render.
// - Voter picks one option and submits.
// - The "You voted on this poll." banner appears.
//
// Skips itself when the demo backend isn't reachable (no demo-account select).

const ORG_SLUG = 'revel-events-collective';
const ALICE_EMAIL = 'alice.owner@example.com';
const CHARLIE_EMAIL = 'charlie.member@example.com';

async function loginAsDemoUser(page: Page, email: string): Promise<void> {
	await page.goto('/login', { timeout: 90_000 });

	const demoSelect = page.locator('#demo-account');
	try {
		await demoSelect.waitFor({ state: 'visible', timeout: 20_000 });
	} catch {
		test.skip(true, 'demo backend not reachable — set PUBLIC_API_URL to a demo-mode Revel backend');
	}

	await demoSelect.selectOption(email);
	await page.getByRole('button', { name: /^sign in as/i }).click();
	await page.waitForURL(/\/dashboard(\/|$|\?)|\/org\//, { timeout: 20_000 });
}

async function logout(page: Page): Promise<void> {
	await page.goto('/logout');
	await page.waitForURL(/\/(?:\?|$)/, { timeout: 10_000 });
}

test.describe('polls voter', () => {
	test('vote → "You voted" banner', async ({ page }) => {
		// --- Admin: create + open a poll ------------------------------------
		// We use the form's defaults (vote_viz=members-only / result_viz=
		// staff-only / timing=never). Charlie is a member of Alpha so the
		// members-only default lets him vote, and bypassing the
		// shadcn-svelte Select portals (which are timing-flaky against the
		// dev-mode webServer) keeps the test stable.
		await loginAsDemoUser(page, ALICE_EMAIL);

		await page.goto(`/org/${ORG_SLUG}/admin/polls/new`);

		// Wait for hydration to finish before any interaction. The MC question-
		// type picker is rendered server-side, but its click handler is wired
		// up during hydration — clicking too early no-ops silently.
		await page.waitForLoadState('networkidle');

		const pollName = `Voter smoke ${Date.now()}`;
		await page.getByLabel(/poll name/i).fill(pollName);

		// Add a multiple-choice question. Click + assert the question count
		// flips from "(0)" to "(1)" before continuing — this catches the
		// hydration race instead of timing out on the next selector.
		await page
			.getByRole('button', { name: /multiple choice/i })
			.first()
			.click();
		await expect(page.getByRole('heading', { name: /questions \(1\)/i })).toBeVisible({
			timeout: 10_000
		});

		const questionInput = page.getByRole('textbox', { name: /question text/i }).first();
		await questionInput.fill('Are you in?');

		// Anchor the regex so we hit the "Option 1" / "Option 2" inputs and not
		// the "Description (optional)" textbox, which also matches /option/i.
		await page.getByRole('textbox', { name: /^Option 1$/i }).fill('Yes');
		await page.getByRole('textbox', { name: /^Option 2$/i }).fill('No');

		await page.getByRole('button', { name: /^create poll$/i }).click();
		await page.waitForURL(/\/admin\/polls\/([0-9a-f-]+)/, { timeout: 30_000 });

		const adminUrl = page.url();
		const pollId = adminUrl.match(/\/admin\/polls\/([0-9a-f-]+)/)?.[1];
		if (!pollId) throw new Error(`Could not extract poll id from ${adminUrl}`);

		// Open the poll so it accepts votes.
		await page.getByRole('button', { name: /^open poll$/i }).click();
		await expect(page.getByRole('button', { name: /^close poll$/i })).toBeVisible({
			timeout: 10_000
		});

		// --- Voter: log in as Charlie and submit a vote ----------------------
		await logout(page);
		await loginAsDemoUser(page, CHARLIE_EMAIL);

		await page.goto(`/org/${ORG_SLUG}/polls/${pollId}`);
		// Same hydration guard as on the admin form — wait for the network
		// to settle so the RadioGroupItem click handlers are bound before we
		// click them.
		await page.waitForLoadState('networkidle');

		// The question text must render. This is the regression guard for
		// the QuestionnaireResponseSchema bug — the empty-form rendered only
		// "Cast your vote" + Submit.
		await expect(page.getByText('Are you in?', { exact: true })).toBeVisible({
			timeout: 10_000
		});

		// Wait for the radio buttons themselves (not just the labels) — the
		// labels render before the radios bind their data-state, and clicking
		// a not-yet-bound radio no-ops silently.
		const radios = page.getByRole('radio');
		await expect(radios).toHaveCount(2, { timeout: 10_000 });

		// Pick the first option. Clicking the radio directly (rather than its
		// label) avoids ambiguity when "Yes" / "No" text might appear
		// elsewhere on the page.
		await radios.first().click();
		await page.getByRole('button', { name: /^submit vote$/i }).click();

		// Post-vote: voted banner appears. We don't assert the results panel
		// because the form's default timing=never hides results from voters.
		await expect(page.getByText(/you voted on this poll/i)).toBeVisible({ timeout: 10_000 });
	});
});
