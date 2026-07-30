import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createVerifiedUser,
	claimTicketViaApi
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J5 (USER_JOURNEYS.md "Event Attendee (RSVP Flow)") — what a public event
// page discloses per `visibility_settings`. Covers the two fields phase 2
// (#713/#718) relocated (`address_visibility`, `show_pronoun_distribution`)
// plus the cheap phase-1 assertions (`show_attendee_count`,
// `show_attendee_list`) phase 1 (#690) left uncovered.
//
// `AttendeeList` renders TWICE per page (mobile `lg:hidden` copy + desktop
// `hidden lg:block` copy) — every locator here is scoped with
// `.filter({ visible: true })` to land on whichever copy the viewport shows.
//
// The component's outer gate is `totalAttendees == null || totalAttendees >
// 0` — for a non-privileged viewer `show_attendee_count: false` nulls the
// count regardless of the real number, but an OWNER bypasses that setting on
// the backend (`can_user_see_attendee_count`) and always sees the real
// count. So any event an owner is expected to view still needs a real
// attendee, or the section won't render for them at all.

test.describe('J5 attendee visibility disclosure @p2', () => {
	test('pronoun distribution: shown to guests only when opted in; owner bypasses the gate', async ({
		asUser,
		asOwner
	}) => {
		test.setTimeout(90_000);

		const [optedIn, optedOut] = await Promise.all([
			createTicketedEvent({
				event: {
					visibility_settings: { show_attendee_count: false, show_pronoun_distribution: true }
				}
			}),
			createTicketedEvent({
				event: {
					visibility_settings: { show_attendee_count: false, show_pronoun_distribution: false }
				}
			})
		]);
		// The owner leg below views `optedOut` and bypasses `show_attendee_count`,
		// so it needs a REAL attendee or the whole section won't render for them.
		if (!optedOut.freeTierId) throw new Error('arranged event is missing its free tier');
		const optedOutAttendee = await createVerifiedUser('OptedOutAttendee');
		await claimTicketViaApi(optedOutAttendee, optedOut.id, optedOut.freeTierId);

		// Opted in: a non-privileged viewer sees the toggle.
		await gotoHydrated(asUser, optedIn.path);
		await waitForClientAuth(asUser);
		const optedInSection = asUser
			.locator('section', { hasText: "Who's Coming" })
			.filter({ visible: true });
		const optedInToggle = optedInSection.getByRole('button', { name: 'Pronoun Distribution' });
		await expect(optedInToggle).toBeVisible();
		await optedInToggle.click();
		await expect(optedInSection.getByText('No attendees yet.')).toBeVisible({ timeout: 15_000 });

		// Opted out: a non-privileged viewer does NOT see the toggle…
		await gotoHydrated(asUser, optedOut.path);
		await waitForClientAuth(asUser);
		const optedOutSectionAsUser = asUser
			.locator('section', { hasText: "Who's Coming" })
			.filter({ visible: true });
		await expect(optedOutSectionAsUser).toBeVisible();
		await expect(
			optedOutSectionAsUser.getByRole('button', { name: 'Pronoun Distribution' })
		).not.toBeVisible();

		// …but the event's own owner bypasses `visibility_settings` entirely
		// and sees it regardless (`VISIBILITY_PRIVILEGED`).
		await gotoHydrated(asOwner, optedOut.path);
		await waitForClientAuth(asOwner);
		const optedOutSectionAsOwner = asOwner
			.locator('section', { hasText: "Who's Coming" })
			.filter({ visible: true });
		await expect(
			optedOutSectionAsOwner.getByRole('button', { name: 'Pronoun Distribution' })
		).toBeVisible();
	});

	test('hides the attendee count and renders the hidden-list copy instead of names', async ({
		asUser
	}) => {
		test.setTimeout(90_000);

		const event = await createTicketedEvent({
			event: {
				visibility_settings: { show_attendee_count: false, show_attendee_list: false }
			}
		});
		// A REAL attendee, so the "hidden list" assertion is falsifiable: if
		// `show_attendee_list` were wired backwards, this name would leak.
		if (!event.freeTierId) throw new Error('arranged event is missing its free tier');
		const attendee = await createVerifiedUser('HiddenAttendee');
		await claimTicketViaApi(attendee, event.id, event.freeTierId);

		await gotoHydrated(asUser, event.path);
		await waitForClientAuth(asUser);
		const section = asUser
			.locator('section', { hasText: "Who's Coming" })
			.filter({ visible: true });
		await expect(section).toBeVisible();

		// No "(N)" count next to the heading.
		await expect(section.getByText(/^\(\d+\)$/)).toHaveCount(0);

		// Hidden-list copy instead of the real attendee's name.
		await expect(
			section.getByText('Attendee list is hidden or no one has confirmed yet.')
		).toBeVisible();
		await expect(section.getByText(attendee.lastName)).toHaveCount(0);
	});
});
