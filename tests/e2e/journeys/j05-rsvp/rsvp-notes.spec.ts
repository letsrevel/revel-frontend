import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// RSVP notes (#651, backend #710) — organizers opt in per event
// (accept_rsvp_notes) to a ≤500-char note with RSVPs. When enabled, every
// RSVP button opens a confirm dialog with an optional, PREFILLED textarea
// (each submission overwrites the stored note wholesale — an empty submit
// clears it). Admin sees the note in Manage Attendees.
//
// Isolation: every test arranges its own throwaway event (and attendee where
// one is needed), so desktop/mobile projects never contend and re-runs never
// see stale state.

const NOTE_LABEL = /Note for the organizers/;

function noteDialog(page: Page) {
	return page.getByRole('dialog', { name: 'Confirm your RSVP' });
}

/** The RSVP card shows a status + "Change RSVP" once an answer exists. */
async function openRsvpButtons(page: Page): Promise<void> {
	const anyControl = page.getByRole('button', { name: /^RSVP Yes|^Change RSVP$/ }).first();
	await expect(anyControl).toBeVisible();
	if ((await anyControl.textContent())?.includes('Change RSVP')) {
		await anyControl.click();
	}
}

function makeNotesEvent(acceptNotes: boolean) {
	return createTicketedEvent({
		freeTier: false,
		event: { requires_ticket: false, ...(acceptNotes ? { accept_rsvp_notes: true } : {}) }
	});
}

/**
 * Confirm the note dialog and wait for the RSVP POST to land server-side.
 * The success banner is transient (auto-hides, and invalidateAll re-renders
 * the card), so callers assert the button's pressed state instead — gating
 * on the response keeps a follow-up reload from racing the persist.
 */
async function confirmNoteDialog(page: Page): Promise<void> {
	const persisted = page.waitForResponse(
		(r) => r.request().method() === 'POST' && /\/rsvp\//.test(r.url()) && r.ok()
	);
	await noteDialog(page)
		.getByRole('button', { name: /^RSVP (Yes|Maybe|No)$/ })
		.click();
	await persisted;
}

test.describe('J5 RSVP notes @p2', () => {
	test('RSVP with a note lands in the admin attendee list', async ({ browser, asOwner }) => {
		const [event, attendee] = await Promise.all([
			makeNotesEvent(true),
			createVerifiedUser('Noter')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, attendee);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// RSVP Yes → the note dialog opens instead of submitting directly.
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		const dialog = noteDialog(page);
		await expect(dialog).toBeVisible();
		const note = `${uniqueName('Note')} — bringing a plus one`;
		await dialog.getByLabel(NOTE_LABEL).fill(note);
		await confirmNoteDialog(page);
		await context.close();

		// The note shows on the admin Manage Attendees page. It renders twice
		// (desktop table + mobile card list, one CSS-hidden) — filter to visible.
		await gotoHydrated(asOwner, `/org/${event.orgSlug}/admin/events/${event.id}/attendees`);
		await waitForClientAuth(asOwner);
		await expect(asOwner.getByText(note).filter({ visible: true })).toBeVisible({
			timeout: 15_000
		});
	});

	test('no note dialog when the event does not accept notes', async ({ browser }) => {
		const [event, attendee] = await Promise.all([
			makeNotesEvent(false),
			createVerifiedUser('NoDialog')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, attendee);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		// Submits directly: success banner appears and no dialog ever opened.
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();
		await expect(noteDialog(page)).toHaveCount(0);

		await context.close();
	});

	test('re-RSVP prefills the note; editing updates it; clearing clears it', async ({ browser }) => {
		const [event, attendee] = await Promise.all([
			makeNotesEvent(true),
			createVerifiedUser('Prefill')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, attendee);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// First RSVP stores the initial note.
		const firstNote = uniqueName('First');
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		const dialog = noteDialog(page);
		await expect(dialog).toBeVisible();
		await dialog.getByLabel(NOTE_LABEL).fill(firstNote);
		await confirmNoteDialog(page);

		// A fresh load pulls the stored note from my-status and prefills it.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Maybe/ }).click();
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel(NOTE_LABEL)).toHaveValue(firstNote);

		// Editing overwrites the stored note.
		const secondNote = uniqueName('Second');
		await dialog.getByLabel(NOTE_LABEL).fill(secondNote);
		await confirmNoteDialog(page);
		await expect(page.getByRole('button', { name: /^RSVP Maybe/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		// The updated note round-trips; clearing the textarea clears it.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel(NOTE_LABEL)).toHaveValue(secondNote);
		await dialog.getByLabel(NOTE_LABEL).fill('');
		await confirmNoteDialog(page);
		await expect(page.getByRole('button', { name: /^RSVP Yes/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		// Cleared for real (server-side), not just locally.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel(NOTE_LABEL)).toHaveValue('');

		await context.close();
	});

	test('event edit form toggles the setting and it persists', async ({ asOwner }) => {
		const event = await makeNotesEvent(false);
		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Edit Event', level: 1 })).toBeVisible();

		// The toggle lives in the collapsible "RSVP Options" section.
		const toggle = page.getByLabel('Accept a note with RSVPs');
		if (!(await toggle.isVisible())) {
			await page.getByRole('button', { name: 'RSVP Options' }).click();
		}
		await expect(toggle).not.toBeChecked();
		await toggle.check();
		// Two SaveBars render (top + bottom of the editor) — take the first.
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();
		await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });

		// The setting survives a fresh load.
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		const reloadedToggle = page.getByLabel('Accept a note with RSVPs');
		if (!(await reloadedToggle.isVisible())) {
			await page.getByRole('button', { name: 'RSVP Options' }).click();
		}
		await expect(reloadedToggle).toBeChecked({ timeout: 15_000 });
	});

	test('cancelling the note dialog does not submit an RSVP', async ({ browser }) => {
		const [event, attendee] = await Promise.all([
			makeNotesEvent(true),
			createVerifiedUser('Canceller')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, attendee);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await openRsvpButtons(page);
		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		const dialog = noteDialog(page);
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).not.toBeVisible();

		// No RSVP went out: no success banner, the buttons are still offered.
		const rsvpStatus = page.getByRole('status').filter({ hasText: /attending|might attend/ });
		await expect(rsvpStatus).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^RSVP Yes/ })).toBeVisible();

		// Still none after a fresh load (nothing was stored server-side).
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: /^RSVP Yes/ })).toBeVisible();
		await expect(rsvpStatus).toHaveCount(0);

		await context.close();
	});
});
