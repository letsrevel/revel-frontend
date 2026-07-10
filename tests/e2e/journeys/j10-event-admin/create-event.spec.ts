import { test, expect, PERSONAS } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { uniqueName } from '../../support/factories';
import { ApiClient } from '../../support/api';

// J10.1–10.2 (USER_JOURNEYS.md) — organizer creates an event through the
// wizard: draft (Save) → edit page → Publish (DRAFT → OPEN) → the event is
// publicly visible to an anonymous visitor.
//
// Events are uniquely named and stay in the org afterwards (no cleanup — the
// reset command in the README restores the seed).

const ORG_SLUG = 'revel-events-collective';

/** datetime-local inputs want the browser-local `YYYY-MM-DDTHH:mm` shape. */
function toDatetimeLocal(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

test.describe('J10 create event via wizard @p0', () => {
	test('draft → publish → publicly visible', async ({ asOwner, browser }) => {
		const name = uniqueName('Wizard');
		const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
		const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

		await gotoHydrated(asOwner, `/org/${ORG_SLUG}/admin/events/new`);
		await waitForClientAuth(asOwner);
		await asOwner.locator('#event-name').fill(name);
		await asOwner.locator('#event-start').fill(toDatetimeLocal(start));
		await asOwner.locator('#event-end').fill(toDatetimeLocal(end));

		// Submit creates the DRAFT and lands on the edit page. The submit can be
		// swallowed while the admin shell settles — retry until it navigates.
		await expect(async () => {
			await asOwner
				.getByRole('button', { name: /^(Save|Create Event)$/ })
				.first()
				.click();
			await asOwner.waitForURL(/\/admin\/events\/[0-9a-f-]+\/edit/, { timeout: 5_000 });
		}).toPass({ timeout: 30_000 });
		const eventId = asOwner.url().match(/events\/([0-9a-f-]+)\/edit/)?.[1];
		if (!eventId) throw new Error(`No event id in URL: ${asOwner.url()}`);

		// Publish (native confirm dialog) — DRAFT → OPEN.
		asOwner.on('dialog', (dialog) => void dialog.accept());
		await asOwner.getByRole('button', { name: 'Publish Event' }).click();
		await expect(asOwner.getByRole('button', { name: 'Close Event' })).toBeVisible();

		// The published event is publicly visible to an anonymous visitor.
		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const { slug } = await owner.get<{ slug: string }>(`/api/events/${eventId}`);

		const guestContext = await browser.newContext();
		const guest = await guestContext.newPage();
		const response = await guest.goto(`/events/${ORG_SLUG}/${slug}`);
		expect(response?.status()).toBe(200);
		await expect(guest.getByRole('heading', { level: 1, name }).first()).toBeVisible();
		// Open for attendance: the RSVP card renders (guests get the sign-in gate).
		await expect(guest.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();
		await guestContext.close();
	});

	test('a draft event is NOT publicly visible', async ({ asOwner, browser }) => {
		const name = uniqueName('Draft');
		const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

		await gotoHydrated(asOwner, `/org/${ORG_SLUG}/admin/events/new`);
		await waitForClientAuth(asOwner);
		await asOwner.locator('#event-name').fill(name);
		await asOwner.locator('#event-start').fill(toDatetimeLocal(start));
		await asOwner
			.locator('#event-end')
			.fill(toDatetimeLocal(new Date(start.getTime() + 60 * 60 * 1000)));
		await expect(async () => {
			await asOwner
				.getByRole('button', { name: /^(Save|Create Event)$/ })
				.first()
				.click();
			await asOwner.waitForURL(/\/admin\/events\/[0-9a-f-]+\/edit/, { timeout: 5_000 });
		}).toPass({ timeout: 30_000 });
		const eventId = asOwner.url().match(/events\/([0-9a-f-]+)\/edit/)?.[1];
		if (!eventId) throw new Error(`No event id in URL: ${asOwner.url()}`);

		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const { slug } = await owner.get<{ slug: string }>(`/api/events/${eventId}`);

		const guestContext = await browser.newContext();
		const guest = await guestContext.newPage();
		const response = await guest.goto(`/events/${ORG_SLUG}/${slug}`);
		expect(response?.status()).toBe(404);
		await guestContext.close();
	});
});
