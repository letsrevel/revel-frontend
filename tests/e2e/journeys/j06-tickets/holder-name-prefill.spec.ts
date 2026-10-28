import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Browser } from '@playwright/test';

// Single-ticket holder-name pre-fill (PR #1115). On an event with
// `require_ticket_names`, an authenticated buyer claiming exactly ONE ticket
// finds the holder name already filled with their own profile name, and the
// ticket is issued under it. A buyer who edits the field keeps their text. A
// free tier keeps the whole flow off Stripe.
//
// The throwaway user registers as first_name "E2E" / last_name <label>, so the
// profile name the sheet pre-fills is "E2E <label>".
//
// Isolation: own event + throwaway buyer (the claim consumes the per-user
// tier limit). The auto "Free Entry" tier is the only tier, so its stepper is
// the one to use.

const LABEL = 'HolderPrefill';
const PROFILE_NAME = `E2E ${LABEL}`;

async function openClaimSheet(browser: Browser) {
	const [event, buyer] = await Promise.all([
		createTicketedEvent({ event: { require_ticket_names: true } }),
		createVerifiedUser(LABEL)
	]);

	const context = await browser.newContext();
	await authenticateContext(context, buyer);
	const page = await context.newPage();
	await gotoHydrated(page, event.path);
	await waitForClientAuth(page);

	const stepper = page.getByRole('group', { name: 'Quantity for Free Entry' });
	await expect(stepper).toBeVisible({ timeout: 15_000 });
	await stepper.getByRole('button', { name: 'Add one Free Entry' }).click();
	await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');

	const sheet = page.getByRole('dialog', { name: 'Checkout' });
	const summaryBar = page.getByTestId('cart-summary-bar');
	// A click during hydration/dialog re-render is occasionally dropped.
	await expect(async () => {
		if (await sheet.isVisible()) return;
		await summaryBar.getByRole('button', { name: /^(Buy|Claim)$/ }).click();
		await expect(sheet).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 30_000 });

	return { context, page, sheet };
}

test.describe('J6 single-ticket holder-name pre-fill @p1', () => {
	test('pre-fills the buyer profile name and issues the ticket under it', async ({ browser }) => {
		test.setTimeout(120_000);
		const { context, page, sheet } = await openClaimSheet(browser);
		try {
			const holder = sheet.getByLabel('Name for ticket 1');
			await expect(holder).toHaveValue(PROFILE_NAME);

			// The pre-fill satisfies the names gate: no hint, claim is enabled.
			await expect(sheet.getByText('Please enter a name for every ticket')).toBeHidden();
			const claim = sheet.getByRole('button', { name: 'Claim', exact: true });
			await expect(claim).toBeEnabled();
			await claim.click();

			const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(modal).toBeVisible({ timeout: 15_000 });
			await expect(modal.getByText(PROFILE_NAME)).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('keeps a name the buyer typed over the pre-fill', async ({ browser }) => {
		test.setTimeout(120_000);
		const { context, page, sheet } = await openClaimSheet(browser);
		try {
			const holder = sheet.getByLabel('Name for ticket 1');
			await expect(holder).toHaveValue(PROFILE_NAME);

			await holder.fill('Grace Hopper');
			await expect(holder).toHaveValue('Grace Hopper');

			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();

			const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(modal).toBeVisible({ timeout: 15_000 });
			await expect(modal.getByText('Grace Hopper')).toBeVisible();
			await expect(modal.getByText(PROFILE_NAME)).toBeHidden();
		} finally {
			await context.close();
		}
	});
});
