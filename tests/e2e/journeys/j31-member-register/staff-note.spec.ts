import type { Locator, Response } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// FE #1165 (BE#1317): a private staff note about a person. Staff with
// `manage_members` write it (here from the event's ticket list); door staff see
// it as a "Staff note" callout in the check-in dialog BEFORE confirming; the
// person it is about never sees it (UI nor API payloads of their own pages).

/** Fill a Tiptap editor and confirm the text landed (a fresh editor can drop the first fill). */
async function fillEditor(editor: Locator, text: string): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt++) {
		await editor.fill(text);
		try {
			await expect(editor).toContainText(text, { timeout: 2_000 });
			return;
		} catch {
			// Fill dropped before mount; try again.
		}
	}
	await expect(editor).toContainText(text);
}

test.describe('J31 private staff note @p1', () => {
	test('written by staff, shown at check-in before confirming, never shown to the attendee', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const org = await createOrganization({ publicVisibility: true });
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			event: { check_in_starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
		});
		if (!event.freeTierId) throw new Error('arranged event is missing its free tier');
		const attendee = await createVerifiedUser('NoteSubject');
		const attendeeName = `${attendee.firstName} ${attendee.lastName}`;
		const ticket = await claimTicketViaApi(attendee, event.id, event.freeTierId);
		const note = `Needs step-free access ${Date.now()}`;

		const staffContext = await browser.newContext();
		await authenticateContext(staffContext, org.owner);
		const staff = await staffContext.newPage();
		try {
			await gotoHydrated(staff, `/org/${org.slug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(staff);

			// Write the note from the holder's row menu.
			await staff
				.getByRole('button', { name: `More actions for ${attendeeName}` })
				.filter({ visible: true })
				.first()
				.click();
			await staff.getByRole('menuitem', { name: 'Add or edit staff note' }).click();
			const noteDialog = staff.getByRole('dialog', { name: `Staff note about ${attendeeName}` });
			await expect(noteDialog).toBeVisible();
			await fillEditor(noteDialog.getByRole('textbox', { name: 'Note' }), note);
			await noteDialog.getByRole('button', { name: 'Save note' }).click();
			await expect(noteDialog).toBeHidden({ timeout: 15_000 });

			// Scan the ticket by manual entry: the callout is in the dialog BEFORE Check In.
			await staff.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
			const scanner = staff.getByRole('dialog', { name: 'Scan QR Code' });
			await scanner.getByLabel('Enter ticket code manually').fill(ticket.id);
			await scanner.getByRole('button', { name: 'Check in' }).click();

			const confirm = staff.getByRole('dialog', { name: 'Check In Attendee' });
			await expect(confirm).toBeVisible({ timeout: 15_000 });
			await expect(confirm.getByText('Staff note', { exact: true })).toBeVisible();
			await expect(confirm.getByText(note)).toBeVisible();
			await confirm.getByRole('button', { name: 'Check In', exact: true }).click();
			await expect(confirm).toBeHidden({ timeout: 15_000 });
		} finally {
			await staffContext.close();
		}

		// The attendee's own surfaces: neither the rendered pages nor any API payload
		// they fetched carries the note.
		const attendeeContext = await browser.newContext();
		await authenticateContext(attendeeContext, attendee);
		const own = await attendeeContext.newPage();
		const leaked: string[] = [];
		// Body reads are collected and awaited before asserting (a handler that is
		// not awaited can finish after the assertion and leak silently).
		const reads: Promise<void>[] = [];
		const inspect = (response: Response): Promise<void> =>
			response.text().then(
				(body) => {
					if (body.includes(note)) leaked.push(response.url());
				},
				() => undefined
			);
		own.on('response', (response) => {
			const url = response.url();
			const type = response.request().resourceType();
			if (url.includes('/api/') || url.includes('__data.json') || type === 'document') {
				reads.push(inspect(response));
			}
		});
		try {
			await gotoHydrated(own, '/dashboard/tickets');
			await waitForClientAuth(own);
			// Positive control: the page did load this attendee's ticket.
			await expect(own.getByText(event.name).filter({ visible: true }).first()).toBeVisible({
				timeout: 15_000
			});
			await gotoHydrated(own, event.path);
			await waitForClientAuth(own);
			await expect(own.getByRole('heading', { level: 1 }).first()).toBeVisible();
			await expect(own.getByText(note)).toHaveCount(0);
			await expect(own.getByText('Staff note')).toHaveCount(0);

			// Server-rendered HTML and SvelteKit data endpoints of each attendee-facing
			// page, fetched with the attendee's cookies, must not carry the note either.
			const origin = new URL(own.url()).origin;
			for (const path of ['/dashboard/tickets', event.path]) {
				for (const suffix of ['', '/__data.json']) {
					const res = await own.request.get(`${origin}${path.replace(/\/$/, '')}${suffix}`);
					reads.push(inspect(res));
				}
			}
			await Promise.all(reads);
			expect(leaked).toEqual([]);
		} finally {
			await attendeeContext.close();
		}
	});
});
