import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	getMyMembership,
	requestMembership,
	setMemberStatus
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J4 (USER_JOURNEYS.md) — the in-app membership card (FE #845 / BE #878).
//
// The card is an IDENTITY credential, not an admission instrument: it is shown
// for every membership status, and what it encodes is the backend's own
// `qr_payload`, never a string this app assembled.
//
// Isolation: throwaway-owned org with an arranged member, so the seeded orgs
// keep their rosters.

/** The Memberships section — see the scoping note at the first call site. */
function memberships(page: import('@playwright/test').Page) {
	return page.getByRole('region', { name: 'Memberships' });
}

test.describe('J4 membership card @p2', () => {
	test('member opens their card and sees the org, tier, QR and downloads', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('CardMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		const context = await browser.newContext();
		await authenticateContext(context, member);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);

		// Scoped to the Memberships section: the Applications section further down
		// renders its own <article aria-label={orgName}> for the same org, and an
		// unscoped lookup is a strict-mode violation.
		const card = memberships(page).getByRole('article', { name: org.name });
		await expect(card).toBeVisible({ timeout: 15_000 });
		await card.getByRole('button', { name: 'Show card' }).click();

		const dialog = page.getByRole('dialog', { name: org.name });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('General membership')).toBeVisible();

		// The QR is generated client-side from the backend payload, so its
		// presence is the end-to-end proof that `qr_payload` reached the browser.
		await expect(dialog.getByRole('img', { name: 'Membership card QR code' })).toBeVisible({
			timeout: 15_000
		});

		// The PDF is ungated — it is the fallback for an org with no wallet
		// integration configured, which is exactly what a throwaway org is.
		await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible();

		await context.close();
	});

	// A member who walks to a door believing a banned card will open it has been
	// failed by this screen. The card still renders — a door must be able to read
	// "banned" rather than find nothing — but it says so in words.
	test('a banned membership still shows a card, and says what it is worth', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('BannedCardMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		await setMemberStatus(org.owner, org.slug, member.email, 'banned');

		const context = await browser.newContext();
		await authenticateContext(context, member);
		const page = await context.newPage();

		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);

		// Scoped to the Memberships section: the Applications section further down
		// renders its own <article aria-label={orgName}> for the same org, and an
		// unscoped lookup is a strict-mode violation.
		const card = memberships(page).getByRole('article', { name: org.name });
		await expect(card).toBeVisible({ timeout: 15_000 });
		await card.getByRole('button', { name: 'Show card' }).click();

		const dialog = page.getByRole('dialog', { name: org.name });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText(/This membership has been revoked/i)).toBeVisible();
		await expect(dialog.getByRole('img', { name: 'Membership card QR code' })).toBeVisible({
			timeout: 15_000
		});

		await context.close();
	});

	// Guards the contract itself: the payload the card renders is the one the
	// backend minted, prefix included. A frontend that assembled `member:<id>`
	// itself would pass every other assertion in this file.
	test('the backend owns the QR payload namespace', async () => {
		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('PayloadMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		const membership = await getMyMembership(member, org.slug);
		expect(membership.qr_payload).toBe(`member:${membership.id}`);
	});
});
