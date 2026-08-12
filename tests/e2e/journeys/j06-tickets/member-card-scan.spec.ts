import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	claimTicketViaApi,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	getMyMembership,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 (USER_JOURNEYS.md) — scanning a MEMBERSHIP card at an event door
// (FE #845 / BE #878). The 200 is a discriminated union and this spec covers
// both arms:
//
//   • exactly one non-cancelled ticket  → `kind: "checked_in"`, the ticket burns
//   • zero tickets                      → `kind: "member"`, NOTHING is checked in
//
// The card is report-only: it never admits anyone by itself. Every scan uses the
// manual-entry path — headless runs have no camera.

const HOUR_MS = 60 * 60 * 1000;

/** An org with an arranged ACTIVE member, plus that member's card payload. */
async function arrangeMemberWithCard(label: string) {
	const org = await createOrganization({ acceptMembershipRequests: true });
	const member = await createVerifiedUser(label);
	const request = await requestMembership(member, org.slug);
	await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
	const membership = await getMyMembership(member, org.slug);
	return { org, member, membership };
}

async function openScanner(page: import('@playwright/test').Page, code: string) {
	await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
	const scanner = page.getByRole('dialog', { name: 'Scan QR Code' });
	await scanner.getByLabel('Enter ticket code manually').fill(code);
	await scanner.getByRole('button', { name: 'Check in' }).click();
}

test.describe('J6 membership card scan @p2', () => {
	test('a member holding one ticket is checked in by their card', async ({ browser }) => {
		test.setTimeout(150_000);

		const { org, member, membership } = await arrangeMemberWithCard('OneTicketMember');
		// Check-in only opens between check_in_starts_at and check_in_ends_at, and
		// the arranged event starts days out — open the window explicitly.
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			event: { check_in_starts_at: new Date(Date.now() - HOUR_MS).toISOString() }
		});
		if (!event.freeTierId) throw new Error('arranged event is missing its free tier');
		const ticket = await claimTicketViaApi(member, event.id, event.freeTierId);
		expect(ticket.status).toBe('active');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await openScanner(page, membership.qr_payload);

		// One unambiguous ticket: the backend burns it and answers with a normal
		// check-in result, so no membership report is shown at all.
		await expect(page.getByRole('dialog', { name: 'Membership card' })).not.toBeVisible();
		const checkedInRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: `${member.firstName} ${member.lastName}` })
			.filter({ hasText: /Checked In/i })
			.first();
		await expect(checkedInRow).toBeVisible({ timeout: 20_000 });

		await context.close();
	});

	test('a member with no ticket gets a report, and nothing is checked in', async ({ browser }) => {
		test.setTimeout(150_000);

		const { org, member, membership } = await arrangeMemberWithCard('NoTicketMember');
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			event: { check_in_starts_at: new Date(Date.now() - HOUR_MS).toISOString() }
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		await openScanner(page, membership.qr_payload);

		const report = page.getByRole('dialog', { name: 'Membership card' });
		await expect(report).toBeVisible({ timeout: 20_000 });
		// Identity: the name and status are what door staff compare against the person.
		await expect(report.getByText(`${member.firstName} ${member.lastName}`)).toBeVisible();
		await expect(report.getByTestId('status-badge')).toHaveText(/active/i);
		// The defining fact, stated rather than implied.
		await expect(report.getByText(/does not admit them/i)).toBeVisible();
		// No tickets → no ticket section, and therefore no check-in button.
		await expect(report.getByRole('button', { name: 'Check in' })).toHaveCount(0);

		await context.close();
	});
});
