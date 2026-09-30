import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, isolatedEmail, uniqueEmail } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated } from '../../support/navigation';
import { extractLink, listEmailIds, waitForEmail } from '../../support/mailpit';

// J15.8 (USER_JOURNEYS.md) — invitation opt-out for an address WITHOUT a Revel
// account: the pending-invitation email carries an `email_opt_out` token; the
// /unsubscribe page shows a one-button confirmation (no preferences form).
// Afterwards a new invitation to that address is still CREATED (it converts on
// registration as usual), only its email is skipped.
//
// Isolation: never-registered unique addresses. The absence is asserted only
// after a control invitation, sent in a SEPARATE, LATER request, was delivered:
// the opted-out address's request had completed and its mail job was queued
// ahead of the control's, so a leaked email would already have landed.

test.describe('J15 invitation opt-out @p2', () => {
	test('an invitee without an account stops invitation emails', async ({ page }) => {
		test.setTimeout(120_000);
		// isolatedEmail: the opt-out suppresses the NORMALIZED address (+tags
		// stripped); a `+tag` address would opt out every E2E mailbox.
		const optedOut = isolatedEmail('OptOut');
		const control = uniqueEmail('OptOutControl');
		const [first, second] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createTicketedEvent({ freeTier: false })
		]);

		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		await owner.post(`/api/event-admin/${first.id}/invitations`, { emails: [optedOut] });
		const message = await waitForEmail({ to: optedOut, subject: "You're invited" });

		await gotoHydrated(page, extractLink(message, /\/unsubscribe\?token=/));
		await expect(page.getByRole('heading', { name: 'Stop invitation emails' })).toBeVisible();
		await expect(page.getByText(optedOut)).toBeVisible();
		// No preferences form for an address without an account.
		await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Stop invitation emails' }).click();
		await expect(
			page.getByText(`We won't send invitation emails to ${optedOut} anymore.`)
		).toBeVisible();

		// Invite the opted-out address to another event, THEN a control in a
		// separate request: the control gets mail, the opted-out address gets
		// none, but its pending invitation still exists.
		await owner.post(`/api/event-admin/${second.id}/invitations`, { emails: [optedOut] });
		await owner.post(`/api/event-admin/${second.id}/invitations`, { emails: [control] });
		await waitForEmail({ to: control, subject: "You're invited" });
		expect(await listEmailIds({ to: optedOut })).toEqual([message.ID]);

		const pending = await owner.get<{ results: Array<{ email: string }> }>(
			`/api/event-admin/${second.id}/pending-invitations`
		);
		expect(pending.results.map((row) => row.email)).toContain(optedOut);
	});
});
