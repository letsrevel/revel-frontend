import { test, expect } from '../../support/fixtures';
import { uniqueName } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// J24 (USER_JOURNEYS.md) — poll administration: create a poll through the
// builder (audience, result timing, anonymity, vote-change policy, one MC
// question), open it, verify the share URL, close it. Rewrite of the pre-v2
// polls-admin smoke onto the v2 infra.
//
// The poll lives on the seeded org: polls gate nothing suite-wide (unlike
// admission questionnaires) and carry uniqueName()s, so parallel workers and
// re-runs never collide.

const ORG_SLUG = 'revel-events-collective';
const QUESTION = 'Which snack should we bring?';

test.describe('J24 poll admin @p1', () => {
	test('create with audience/anonymity/timing config → open → share → close', async ({
		asOwner: page
	}) => {
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/polls/new`);
		await waitForClientAuth(page);

		const name = uniqueName('PollAdmin');
		await page.getByLabel('Poll name').fill(name);

		// Audience + results configuration: the dropdowns are bits-ui Selects
		// (portalled listboxes), the anonymity/vote-change toggles are native
		// checkboxes.
		await pickSelectOption(page, page.locator('#vote-visibility'), 'Public');
		await pickSelectOption(page, page.locator('#result-timing'), 'After voting');
		await page.getByLabel('Hide voter identities from staff').uncheck();
		await page.getByLabel(/Allow voters to change their vote/).check();

		// Add one MC question — outcome-keyed: the "Questions (N)" header count
		// proves the click landed (a pre-hydration click no-ops silently).
		const questionCount = page.getByRole('heading', { name: 'Questions (1)' });
		await expect(async () => {
			if (!(await questionCount.isVisible())) {
				await page.getByRole('button', { name: 'Multiple Choice' }).first().click();
			}
			await expect(questionCount).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 20_000 });

		const questionEditor = page.getByRole('textbox', { name: 'Question Text (Markdown)' }).first();
		await questionEditor.fill(QUESTION);
		await page.getByPlaceholder('Option 1').fill('Pretzels');
		await page.getByPlaceholder('Option 2').fill('Popcorn');

		// A freshly-mounted Tiptap editor can silently drop its fill() while it
		// settles (same trap as the questionnaire builder) — re-fill inside the
		// outcome-keyed save loop, keyed on the redirect to the detail page.
		await expect(async () => {
			if (!(await questionEditor.innerText()).includes(QUESTION)) {
				await questionEditor.fill(QUESTION);
			}
			await page.getByRole('button', { name: 'Create poll' }).click();
			await page.waitForURL(/\/admin\/polls\/(?!new)[0-9a-f-]+/, { timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// The detail page round-trips the config: DRAFT status, staff anonymity
		// off, vote changes allowed (the anonymity boxes render locked here —
		// they are immutable after create).
		await expect(page.getByText(name).first()).toBeVisible();
		await expect(
			page.getByText('Draft', { exact: true }).filter({ visible: true }).first()
		).toBeVisible();
		await expect(page.getByLabel('Hide voter identities from staff')).not.toBeChecked();
		await expect(page.getByLabel(/Allow voters to change their vote/)).toBeChecked();

		// Open → the share strip appears carrying THIS poll's voter URL.
		await page.getByRole('button', { name: 'Open poll' }).click();
		await expect(page.getByRole('button', { name: 'Close poll' })).toBeVisible({
			timeout: 20_000
		});
		const pollId = page.url().match(/\/admin\/polls\/([0-9a-f-]+)/)?.[1];
		expect(pollId, `poll id extractable from ${page.url()}`).toBeTruthy();
		await expect(page.getByLabel('Poll share URL')).toHaveValue(
			new RegExp(`/org/${ORG_SLUG}/polls/${pollId}$`)
		);

		// Close → the reopen affordance replaces it.
		await page.getByRole('button', { name: 'Close poll' }).click();
		await expect(page.getByRole('button', { name: 'Reopen poll' })).toBeVisible({
			timeout: 20_000
		});
	});
});
