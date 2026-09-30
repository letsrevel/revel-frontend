import { test, expect } from '../../support/fixtures';
import { createOrganization, createTicketedEvent } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Locator } from '@playwright/test';

// J10.7 / J12.2 (USER_JOURNEYS.md) — invitation cap: invitations to addresses
// without an account are limited per organization per UTC day
// (PENDING_INVITATION_DAILY_CAP, 200 by default). A request over the limit is
// refused whole (400, nothing created); the create dialog shows the backend's
// message and keeps every address so the organizer can trim and retry. More
// than 500 addresses per request is blocked client-side (the endpoint 422s).
//
// Isolation: the counter lives in Redis and survives reseeds, so each run uses
// a FRESH org (its own budget) with brand-new addresses.

const DAILY_CAP = 200;

function addresses(count: number, prefix: string): string[] {
	const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	return Array.from({ length: count }, (_, i) => `e2e+${prefix}-${run}-${i}@example.com`);
}

/** EmailTagInput accepts a pasted list (newline/comma/space separated). */
async function pasteInto(input: Locator, emails: string[]): Promise<void> {
	await input.evaluate((node, text) => {
		const data = new DataTransfer();
		data.setData('text', text);
		node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
	}, emails.join('\n'));
}

test.describe('J10 invitation cap @p2', () => {
	test('over the daily cap: refused whole, draft kept; over 500: blocked', async ({ browser }) => {
		test.setTimeout(120_000);
		const org = await createOrganization();
		const event = await createTicketedEvent({ owner: org.owner, orgSlug: org.slug });
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(
			page,
			`/org/${org.slug}/admin/events/${event.id}/invitations?tab=invitations`
		);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Create Invitations' }).click();
		const dialog = page.getByRole('dialog', { name: 'Create Invitations' });
		const input = dialog.locator('#email-tag-input');

		const overCap = addresses(DAILY_CAP + 1, 'cap');
		await pasteInto(input, overCap);
		await expect(dialog.getByText(overCap[0], { exact: true })).toBeVisible();
		await dialog.getByRole('button', { name: 'Send Invitations' }).click();

		await expect(dialog.getByRole('alert')).toContainText(
			`can invite only ${DAILY_CAP} more today`
		);
		// Dialog still open, every address kept for a trimmed retry.
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText(overCap[DAILY_CAP], { exact: true })).toBeVisible();

		// All-or-nothing: no pending invitation was created.
		const api = await ApiClient.login(org.owner.email, org.owner.password);
		const pending = await api.get<{ count: number }>(
			`/api/event-admin/${event.id}/pending-invitations`
		);
		expect(pending.count).toBe(0);

		// Past 500 addresses the form refuses to send at all.
		await pasteInto(input, addresses(300, 'bulk'));
		await expect(dialog.getByText(/You can invite up to 500 addresses at once/)).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Send Invitations' })).toBeDisabled();
	});
});
