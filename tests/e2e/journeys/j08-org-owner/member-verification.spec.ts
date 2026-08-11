import { test, expect } from '../../support/fixtures';
import {
	addStaff,
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	getMyMembership,
	requestMembership,
	setMemberStatus
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — org-scoped membership-card verification at a door
// (FE #845 / BE #878), outside any event.
//
// The endpoint deliberately reports EVERY status rather than 404ing on a
// non-active member: door staff need to read "banned", not a lookup failure.
// Both assertions below are about that.
//
// Camera: headless runs have none, so every scan goes through the manual-entry
// field — which is also the keyboard-operable path and therefore worth covering.

test.describe('J8 member verification @p2', () => {
	test('verifying an active card identifies the member', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('DoorMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const membership = await getMyMembership(member, org.slug);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/members/verify`);
		await waitForClientAuth(page);

		await page.getByLabel('Enter a card code').fill(membership.qr_payload);
		await page.getByRole('button', { name: 'Verify' }).click();

		const result = page.getByRole('region', { name: 'Scan result' });
		await expect(result.getByText(`${member.firstName} ${member.lastName}`)).toBeVisible({
			timeout: 15_000
		});
		await expect(result.getByTestId('status-badge')).toHaveText(/active/i);
		await expect(result.getByText('General membership')).toBeVisible();
	});

	test('a banned card reports the ban instead of failing the lookup', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('BannedDoorMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const membership = await getMyMembership(member, org.slug);
		await setMemberStatus(org.owner, org.slug, member.email, 'banned');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/members/verify`);
		await waitForClientAuth(page);

		await page.getByLabel('Enter a card code').fill(membership.qr_payload);
		await page.getByRole('button', { name: 'Verify' }).click();

		const result = page.getByRole('region', { name: 'Scan result' });
		await expect(result.getByTestId('status-badge')).toHaveText(/banned/i, { timeout: 15_000 });
		// The badge states the fact; the alert states the consequence, which is
		// the part someone working a door at 1am actually needs.
		await expect(result.getByRole('alert')).toContainText(/banned from this organization/i);
	});

	// The verify surface is gated on `check_in_attendees`, NOT `manage_members`.
	// Two different doors close here, and only the second one is this feature's:
	//
	//   • a plain MEMBER 404s in the admin layout — `organizationadmincoreGetOrganization`
	//     hides the org from non-staff entirely (same behaviour j09 documents);
	//   • a STAFF member who holds other permissions but not `check_in_attendees`
	//     reaches the layout and is stopped by this page's own load.
	//
	// Both are asserted on the rendered page, NOT on the document status: the
	// route is `ssr = false`, so SvelteKit always serves a 200 shell and the
	// server load's error arrives with the client-side data fetch.
	test('a plain member never reaches the admin surface at all', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('NosyMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		const context = await browser.newContext();
		await authenticateContext(context, member);
		const page = await context.newPage();

		await page.goto(`/org/${org.slug}/admin/members/verify`);
		await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByLabel('Enter a card code')).toBeHidden();

		await context.close();
	});

	test('staff without check_in_attendees are denied the verify page', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const staffer = await createVerifiedUser('NoDoorStaff');
		const request = await requestMembership(staffer, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		// A narrow map: enough to be staff and load the admin layout, explicitly
		// WITHOUT the door permission (which staff would otherwise get by default).
		await addStaff(org.owner, org.slug, staffer.email, {
			view_organization_details: true,
			check_in_attendees: false
		});

		const context = await browser.newContext();
		await authenticateContext(context, staffer);
		const page = await context.newPage();

		await page.goto(`/org/${org.slug}/admin/members/verify`);
		await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByLabel('Enter a card code')).toBeHidden();

		await context.close();
	});
});
