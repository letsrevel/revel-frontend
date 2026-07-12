import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	requestMembership,
	approveMembershipRequest,
	rsvpViaApi
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 manage RSVPs (#616, shipped as PRs #621+#622) — the Manage Attendees
// page: create an RSVP on behalf of an org member ("Add attendee" dialog,
// backend upserts on (event, user)) and the multi-select status filter
// (aria-pressed toggle buttons that combine into ?status=a,b and reload the
// list through the load function).
//
// Isolation: everything is arranged fresh. The member combobox searches ORG
// MEMBERS only, so the create-on-behalf target must be approved into a
// throwaway org first; the event must have requires_ticket=false (the
// attendees page 302s ticketed events to .../tickets).

test.describe('J10 manage RSVPs @p2', () => {
	test('owner creates an RSVP on behalf of a member; re-submitting upserts', async ({
		browser
	}) => {
		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('OnBehalf')
		]);
		const [event, request] = await Promise.all([
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				freeTier: false,
				event: { requires_ticket: false }
			}),
			requestMembership(member, org.slug)
		]);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const memberName = `${member.firstName} ${member.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/events/${event.id}/attendees`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Attendees', level: 1 })).toBeVisible();
		await expect(page.getByText("No one has RSVP'd to this event yet.")).toBeVisible();

		// Create on behalf — search by email (unique per run), default status Yes.
		await page.getByRole('button', { name: 'Add attendee' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add attendee' });
		await expect(dialog).toBeVisible();
		// Submit stays disabled until a member is actually picked.
		await expect(dialog.getByRole('button', { name: 'Add attendee' })).toBeDisabled();
		const combobox = dialog.getByRole('combobox', { name: 'Member' });
		await combobox.click();
		await combobox.fill(member.email);
		// String name = substring match (a RegExp would need the '+' escaped).
		const option = page.getByRole('option', { name: member.email });
		await expect(option).toBeVisible({ timeout: 15_000 });
		await option.click();
		await dialog.getByRole('button', { name: 'Add attendee' }).click();
		await expect(page.getByText('RSVP saved')).toBeVisible({ timeout: 15_000 });
		await expect(dialog).not.toBeVisible();
		// The new row lands without a full reload (invalidateAll refresh).
		const memberRow = page.getByRole('button', { name: `Edit RSVP for ${memberName}` });
		await expect(memberRow).toBeVisible({ timeout: 15_000 });

		// Upsert: submit the SAME member again with status No — the endpoint
		// updates in place, so the row's status flips and nothing duplicates.
		await page.getByRole('button', { name: 'Add attendee' }).first().click();
		await expect(dialog).toBeVisible();
		await combobox.click();
		await combobox.fill(member.email);
		await expect(option).toBeVisible({ timeout: 15_000 });
		await option.click();
		await dialog.getByRole('radio', { name: 'No - Not attending' }).check();
		await dialog.getByRole('button', { name: 'Add attendee' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 15_000 });

		// Status is now No: the Yes-only filter hides the row, the No filter
		// shows exactly one (no duplicate from the upsert).
		const filters = page.getByRole('group', { name: 'Filter by status' });
		await filters.getByRole('button', { name: 'Yes', exact: true }).click();
		await expect(page).toHaveURL(/status=yes/);
		await expect(memberRow).toHaveCount(0);
		await filters.getByRole('button', { name: 'Yes', exact: true }).click(); // untoggle
		await filters.getByRole('button', { name: 'No', exact: true }).click();
		await expect(page).toHaveURL(/status=no/);
		await expect(memberRow).toHaveCount(1);

		await context.close();
	});

	test('multi-select status filter combines statuses', async ({ asOwner }) => {
		const [event, yesUser, maybeUser, noUser] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { requires_ticket: false } }),
			createVerifiedUser('FilterYes'),
			createVerifiedUser('FilterMaybe'),
			createVerifiedUser('FilterNo')
		]);
		await Promise.all([
			rsvpViaApi(yesUser, event.id, 'yes'),
			rsvpViaApi(maybeUser, event.id, 'maybe'),
			rsvpViaApi(noUser, event.id, 'no')
		]);
		const rowFor = (u: { firstName: string; lastName: string }) =>
			asOwner.getByRole('button', { name: `Edit RSVP for ${u.firstName} ${u.lastName}` });

		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/attendees`);
		await waitForClientAuth(page);

		// Unfiltered: "All" is pressed and every row shows.
		const filters = page.getByRole('group', { name: 'Filter by status' });
		await expect(filters.getByRole('button', { name: /^All \(/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(rowFor(yesUser)).toBeVisible();
		await expect(rowFor(maybeUser)).toBeVisible();
		await expect(rowFor(noUser)).toBeVisible();

		// Single select: Yes only.
		await filters.getByRole('button', { name: 'Yes', exact: true }).click();
		await expect(filters.getByRole('button', { name: 'Yes', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page).toHaveURL(/status=yes/);
		await expect(rowFor(yesUser)).toBeVisible();
		await expect(rowFor(maybeUser)).toHaveCount(0);
		await expect(rowFor(noUser)).toHaveCount(0);

		// Multi select: Yes + Maybe combined.
		await filters.getByRole('button', { name: 'Maybe', exact: true }).click();
		await expect(rowFor(yesUser)).toBeVisible();
		await expect(rowFor(maybeUser)).toBeVisible();
		await expect(rowFor(noUser)).toHaveCount(0);

		// "All" clears the filter set.
		await filters.getByRole('button', { name: /^All \(/ }).click();
		await expect(filters.getByRole('button', { name: 'Yes', exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
		await expect(rowFor(noUser)).toBeVisible();
	});
});
