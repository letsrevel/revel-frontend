import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createVerifiedUser,
	rsvpViaApi,
	uniqueName
} from '../../support/factories';
import { ApiError, API_URL, fetchWithRetry, obtainTokenPair } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 stats + schedule + resources.
//
// "Stats" redefined (#617): there is NO statistics tab — the stats surface
// is the AttendeeStats tile row on Manage Attendees, so that's what the
// counts are asserted against.
//
// Schedule and resources are SECTIONS of the event editor (no tabs at all on
// non-ticketed events), saved through the page-level SaveBar; resources are
// an org-level pool the editor merely attaches. Both must then show on the
// public event page (schedule <section>, "Event Resources" with an Open
// action for link resources).

function toDatetimeLocal(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe('J10 stats, schedule & resources @p2', () => {
	test('attendee stats tiles count the RSVP mix', async ({ asOwner }) => {
		const [event, yes1, yes2, maybe1, no1] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { requires_ticket: false } }),
			createVerifiedUser('StatsYesA'),
			createVerifiedUser('StatsYesB'),
			createVerifiedUser('StatsMaybe'),
			createVerifiedUser('StatsNo')
		]);
		await Promise.all([
			rsvpViaApi(yes1, event.id, 'yes'),
			rsvpViaApi(yes2, event.id, 'yes'),
			rsvpViaApi(maybe1, event.id, 'maybe'),
			rsvpViaApi(no1, event.id, 'no')
		]);

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/attendees`);
		await waitForClientAuth(page);

		// Each stat tile is a bordered card: label <p class="text-sm"> above
		// the count <p class="text-2xl"> (no roles to hook into).
		const tileCount = (label: string) =>
			page
				.locator('div.rounded-lg', {
					has: page.locator('p.text-sm', { hasText: new RegExp(`^${label}$`) })
				})
				.locator('p.text-2xl');
		await expect(tileCount('Total')).toHaveText('4', { timeout: 15_000 });
		await expect(tileCount('Yes')).toHaveText('2');
		await expect(tileCount('Maybe')).toHaveText('1');
		await expect(tileCount('No')).toHaveText('1');
		// The filter bar's "All" pill carries the same total.
		await expect(
			page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'All (4)' })
		).toBeVisible();
	});

	test('schedule sessions and attached resources reach the public page', async ({
		asOwner,
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false }
		});
		// The editor only ATTACHES org-pool resources, so arrange one via the
		// org-admin API (public visibility so a guest can see it; kept off the
		// org page to avoid polluting unrelated specs).
		const resourceName = uniqueName('Resource');
		// The create-resource endpoint takes multipart FORM fields (files ride
		// along for `file` resources), not JSON — post FormData directly.
		const { access } = await obtainTokenPair(PERSONAS.owner.email, PERSONAS.owner.password);
		const form = new FormData();
		form.set('name', resourceName);
		form.set('resource_type', 'link');
		form.set('link', 'https://example.com/e2e-resource');
		form.set('visibility', 'public');
		form.set('display_on_organization_page', 'false');
		const resourceResponse = await fetchWithRetry(
			`${API_URL}/api/organization-admin/${event.orgSlug}/resources`,
			{ method: 'POST', headers: { Authorization: `Bearer ${access}` }, body: form }
		);
		if (!resourceResponse.ok) {
			throw new ApiError(
				resourceResponse.status,
				'POST',
				'/resources',
				await resourceResponse.text()
			);
		}

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);

		// Schedule section: add one session (times are relative to event start).
		await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Add session' }).click();
		const sessionTitle = uniqueName('Keynote');
		await page.getByLabel('Session title').fill(sessionTitle);
		// The factory event starts +7 days out; place the session an hour in.
		const sessionStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
		await page.getByLabel('Starts at').fill(toDatetimeLocal(sessionStart));

		// Resources section: toggle the org resource on (row is a button
		// named by the resource).
		await expect(page.getByRole('heading', { name: 'Attach Resources' })).toBeVisible();
		await page.getByRole('button', { name: new RegExp(resourceName) }).click();
		await expect(page.getByText('1 resource attached')).toBeVisible();

		// Persist through the SaveBar (two render — top + bottom of the editor).
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();
		await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });

		// A logged-out guest sees both on the public event page (SSR).
		const guestContext = await browser.newContext();
		const guestPage = await guestContext.newPage();
		await guestPage.goto(event.path);
		await expect(guestPage.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({
			timeout: 15_000
		});
		await expect(guestPage.getByText(sessionTitle)).toBeVisible();
		await expect(guestPage.getByRole('heading', { name: 'Event Resources' })).toBeVisible();
		await expect(guestPage.getByText(resourceName)).toBeVisible();
		await expect(guestPage.getByRole('button', { name: /Open/ })).toBeVisible();
		await guestContext.close();
	});
});
