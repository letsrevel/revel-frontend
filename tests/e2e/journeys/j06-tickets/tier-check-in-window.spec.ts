import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketTier,
	createTicketedEvent,
	createVerifiedUser,
	uniqueName,
	type ThrowawayUser
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #945 (backend #994) — per-tier check-in windows, stored as offsets from the
// event start. Three journeys:
//   1. the organizer sets/clears a tier's window in the tier form, and the
//      public event page shows the tier's own "Entry: …" window;
//   2. the scanner refuses a ticket whose TIER window hasn't opened, even
//      though the event's window is open, with the tier-specific message;
//   3. the scanner admits a ticket whose tier opens EARLY, even though the
//      event's window is still closed (VIP early entry).
//
// Isolation: every test arranges its own event/tier/attendee via the API.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A whole-minute event start a week out, so datetime-local values are exact. */
function eventTimes(): { start: string; end: string } {
	const start = new Date(Date.now() + 7 * DAY_MS);
	start.setUTCSeconds(0, 0);
	return {
		start: start.toISOString(),
		end: new Date(start.getTime() + 3 * HOUR_MS).toISOString()
	};
}

/**
 * The `datetime-local` value for an instant, in the BROWSER's timezone — the
 * same conversion the event editor applies to the event start, which the
 * tier offsets are computed against.
 */
async function toBrowserLocal(page: Page, iso: string): Promise<string> {
	return page.evaluate((value) => {
		const d = new Date(value);
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}, iso);
}

/** Arrange an event with one free tier carrying check-in offsets, and a ticket on it. */
async function arrangeTicketOnTier(
	label: string,
	options: { event?: Record<string, unknown>; tier: Record<string, unknown> }
): Promise<{
	event: Awaited<ReturnType<typeof createTicketedEvent>>;
	tierName: string;
	attendee: ThrowawayUser;
	ticketId: string;
}> {
	const [event, attendee] = await Promise.all([
		createTicketedEvent({ freeTier: false, event: { ...eventTimes(), ...options.event } }),
		createVerifiedUser(label)
	]);
	const tierName = uniqueName('Tier');
	const tier = await createTicketTier(event.id, {
		name: tierName,
		payment_method: 'free',
		price: '0.00',
		...options.tier
	});
	const ticket = await claimTicketViaApi(attendee, event.id, tier.id);
	expect(ticket.status).toBe('active');
	return { event, tierName, attendee, ticketId: ticket.id };
}

/** Scanner manual-entry → confirm dialog → Check In. Returns the confirm dialog. */
async function scanAndConfirm(page: Page, ticketId: string, attendeeEmail: string) {
	await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
	const scanner = page.getByRole('dialog', { name: 'Scan QR Code' });
	await scanner.getByLabel('Enter ticket code manually').fill(ticketId);
	await scanner.getByRole('button', { name: 'Check in' }).click();

	const confirm = page.getByRole('dialog', { name: 'Check In Attendee' });
	await expect(confirm).toBeVisible({ timeout: 15_000 });
	await expect(confirm.getByText(attendeeEmail)).toBeVisible();
	await confirm.getByRole('button', { name: 'Check In', exact: true }).click();
	return confirm;
}

test.describe('J6 per-tier check-in window @p1', () => {
	test('organizer sets and clears a tier window; the public page shows its entry time', async ({
		asOwner
	}) => {
		test.setTimeout(120_000);
		const times = eventTimes();
		const event = await createTicketedEvent({ event: times }); // arrives with "Free Entry"

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit?tab=ticketing`);
		await waitForClientAuth(page);
		await expect(page.getByText('Free Entry').first()).toBeVisible({ timeout: 15_000 });

		const tierForm = page.getByRole('dialog', { name: /Edit Ticket Tier/ });
		const opensPicker = tierForm.getByLabel('Check-in opens');
		const opensAt = await toBrowserLocal(
			page,
			new Date(new Date(times.start).getTime() - HOUR_MS).toISOString()
		);

		// SET: doors open one hour before the event starts.
		await page.getByRole('button', { name: 'Edit Free Entry' }).click();
		await expect(tierForm).toBeVisible();
		await expect(tierForm.getByText("Defaults to the event's check-in window")).toHaveCount(2);
		await opensPicker.fill(opensAt);
		await expect(tierForm.getByText('1 hour before event start')).toBeVisible();
		await tierForm.getByRole('button', { name: 'Save Changes' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });

		// Round-trip: reopening seeds the picker from the stored offset.
		await page.getByRole('button', { name: 'Edit Free Entry' }).click();
		await expect(tierForm).toBeVisible();
		await expect(opensPicker).toHaveValue(opensAt, { timeout: 15_000 });
		await expect(tierForm.getByText('1 hour before event start')).toBeVisible();
		await tierForm.getByRole('button', { name: 'Cancel' }).click();
		await expect(tierForm).not.toBeVisible();

		// The public tier card shows the tier's own entry window.
		await gotoHydrated(page, event.path);
		await expect(
			page
				.getByText(/Entry: /)
				.filter({ visible: true })
				.first()
		).toBeVisible({
			timeout: 15_000
		});

		// CLEAR: back to the event's window — the entry line disappears.
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit?tab=ticketing`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Edit Free Entry' }).click();
		await expect(tierForm).toBeVisible();
		await expect(opensPicker).toHaveValue(opensAt, { timeout: 15_000 });
		await tierForm.getByRole('button', { name: 'Clear check-in opening time' }).click();
		await expect(opensPicker).toHaveValue('');
		await expect(opensPicker).toBeFocused();
		await tierForm.getByRole('button', { name: 'Save Changes' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });

		await gotoHydrated(page, event.path);
		await expect(page.getByText('Free Entry').first()).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/Entry: /)).toHaveCount(0);
	});

	test('scanner refuses a ticket whose tier window has not opened yet', async ({ asOwner }) => {
		// The EVENT's check-in window is open (started an hour ago), but this
		// tier only opens one hour before the event start, a week out.
		const { event, tierName, attendee, ticketId } = await arrangeTicketOnTier('TierNotOpen', {
			event: { check_in_starts_at: new Date(Date.now() - HOUR_MS).toISOString() },
			tier: { check_in_opens_offset: '-PT1H' }
		});

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);

		const confirm = await scanAndConfirm(page, ticketId, attendee.email);
		// The backend's tier-specific 400 is shown verbatim, inline in the dialog.
		await expect(confirm.getByRole('alert')).toContainText(
			`Check-in for ${tierName} is not open yet`,
			{ timeout: 15_000 }
		);
		await expect(confirm).toBeVisible();
	});

	test('scanner admits early entry on a tier that opens before the event window', async ({
		asOwner
	}) => {
		// The EVENT's check-in window defaults to its start (a week out, so it
		// is closed), but this tier opens eight days before the start: now open.
		const { event, attendee, ticketId } = await arrangeTicketOnTier('TierEarly', {
			tier: { check_in_opens_offset: '-P8D' }
		});

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);

		const confirm = await scanAndConfirm(page, ticketId, attendee.email);
		await expect(confirm).not.toBeVisible({ timeout: 15_000 });

		const checkedInRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: `${attendee.firstName} ${attendee.lastName}` })
			.filter({ hasText: /Checked In/i })
			.first();
		await expect(checkedInRow).toBeVisible({ timeout: 15_000 });
	});
});
