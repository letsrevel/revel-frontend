import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createPoll } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J24 (USER_JOURNEYS.md) — poll voting: a member casts a vote, the
// vote-change policy gates re-vote/withdraw, and result visibility + timing
// gate the Results card. Rewrite of the pre-v2 polls-voter smoke.
//
// Isolation: polls are never seeded — each test API-creates its own on the
// seeded org (charlie is a member, so the members-only default audience lets
// him vote). Voters reach a poll only via its direct share URL: there is no
// public poll listing.

/**
 * Cast (or re-cast) a vote, outcome-keyed on the voted banner: re-click the
 * option + submit until the vote sticks. Safe to call while the ballot is
 * showing; exits immediately if the banner is already up.
 */
async function castVote(page: Page, optionIndex: number): Promise<void> {
	const banner = page.getByText('You voted on this poll.');
	await expect(async () => {
		if (!(await banner.isVisible())) {
			const radios = page.getByRole('radio');
			await expect(radios).toHaveCount(2, { timeout: 3_000 });
			await radios.nth(optionIndex).click();
			await page.getByRole('button', { name: 'Submit vote' }).click();
		}
		await expect(banner).toBeVisible({ timeout: 5_000 });
	}).toPass({ timeout: 30_000 });
}

test.describe('J24 poll voting @p1', () => {
	test('locked poll: vote sticks, no change/withdraw, results stay hidden', async ({
		asMember: page
	}) => {
		// Backend/create defaults: allow_vote_changes=false, result_timing=never.
		const poll = await createPoll();

		await gotoHydrated(page, poll.path);
		await waitForClientAuth(page);

		// The ballot renders the question with its two options.
		await expect(page.getByText('Are you in?').first()).toBeVisible();
		await castVote(page, 0);

		// allow_vote_changes=false → no re-vote affordances…
		await expect(page.getByRole('button', { name: 'Change my vote' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Withdraw vote' })).toHaveCount(0);
		// …and result_timing=never keeps results hidden even after voting.
		await expect(page.getByRole('heading', { name: 'Results' })).toHaveCount(0);
	});

	test('changes allowed: results after voting, change vote, withdraw restores ballot', async ({
		asMember: page
	}) => {
		const poll = await createPoll({
			poll: {
				allow_vote_changes: true,
				result_visibility: 'members-only',
				result_timing: 'after_vote'
			}
		});

		await gotoHydrated(page, poll.path);
		await waitForClientAuth(page);
		await castVote(page, 0);

		// result_timing=after_vote + members-only: the Results card appears
		// once this member has voted, with the vote tallied.
		await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText('1 voter', { exact: true })).toBeVisible();

		// Change the vote: the ballot comes back prefilled; flip the answer.
		await page.getByRole('button', { name: 'Change my vote' }).click();
		await expect(page.getByRole('button', { name: 'Submit vote' })).toBeVisible();
		await castVote(page, 1);

		// The changed vote round-trips: re-entering edit mode shows the OTHER
		// option preselected (prefill comes from the server's user_vote).
		await page.getByRole('button', { name: 'Change my vote' }).click();
		const radios = page.getByRole('radio');
		await expect(radios).toHaveCount(2);
		await expect(radios.nth(1)).toBeChecked();
		await expect(radios.nth(0)).not.toBeChecked();

		// Withdraw (from edit mode the banner controls are hidden — go back to
		// it by reloading the poll, then confirm through the danger dialog).
		await gotoHydrated(page, poll.path);
		await waitForClientAuth(page);
		const withdrawDialog = page.getByRole('dialog', { name: 'Withdraw your vote' });
		await expect(async () => {
			if (!(await withdrawDialog.isVisible())) {
				await page.getByRole('button', { name: 'Withdraw vote' }).click();
			}
			await withdrawDialog.getByRole('button', { name: 'Withdraw vote' }).click();
			// Outcome: the submission is gone, so the ballot is offered again.
			await expect(page.getByRole('button', { name: 'Submit vote' })).toBeVisible({
				timeout: 5_000
			});
		}).toPass({ timeout: 30_000 });
		await expect(page.getByText('You voted on this poll.')).toHaveCount(0);
		// No submission → after_vote timing hides the results again.
		await expect(page.getByRole('heading', { name: 'Results' })).toHaveCount(0);
	});
});
