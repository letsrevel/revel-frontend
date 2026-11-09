import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership,
	uniqueEmail,
	uniqueName
} from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	claimPathFromLink,
	createRegisterEntry,
	daysFromNow,
	inviteRegisterEntry,
	patchRegisterEntry
} from '../../support/member-register';
import type { RegisterRecord } from '../../support/member-register';

// FE #1171: the claim endpoint's two 409s carry a machine `code` and the page
// maps each to its own localized sentence (never matching on server text).
//   already_member: the claimer already holds an open membership of the org.
//   not_started:    the entry's valid_from is still in the future.

async function invitedEntry(
	org: Awaited<ReturnType<typeof createOrganization>>
): Promise<{ record: RegisterRecord; claimPath: string }> {
	const invitedEmail = uniqueEmail('Invited');
	const record = await createRegisterEntry(org.owner, org.slug, {
		fullName: uniqueName('Invitee'),
		email: invitedEmail,
		tierId: org.defaultTierId
	});
	await inviteRegisterEntry(org.owner, org.slug, record.id);
	const invite = await waitForEmail({ to: invitedEmail });
	return { record, claimPath: claimPathFromLink(extractLink(invite, /\/member-invite\//)) };
}

test.describe('J31 claim collisions @p2', () => {
	test('409 already_member: a claimer who is already a member sees the duplicate copy', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization({ acceptMembershipRequests: true });
		const claimer = await createVerifiedUser('AlreadyMember');
		const request = await requestMembership(claimer, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const { claimPath } = await invitedEntry(org);

		const page = await pageAs(browser, claimer);
		try {
			await gotoHydrated(page, claimPath);
			await waitForClientAuth(page);
			await page.getByRole('button', { name: 'Link to my account' }).click();

			await expect(
				page.getByRole('heading', { name: "We couldn't link this membership" })
			).toBeVisible({ timeout: 20_000 });
			await expect(
				page.getByText(
					'You already have a membership in this organization. Its staff can review the duplicate entry in their member register.'
				)
			).toBeVisible();
			await expect(page.getByRole('button', { name: 'Link to my account' })).toHaveCount(0);
		} finally {
			await page.context().close();
		}
	});

	test('409 not_started: an entry that starts later cannot be claimed yet', async ({ browser }) => {
		test.setTimeout(180_000);
		const org = await createOrganization();
		const claimer = await createVerifiedUser('TooEarly');
		const { record, claimPath } = await invitedEntry(org);
		// Only a started entry can be invited, so push the start out afterwards.
		await patchRegisterEntry(org.owner, org.slug, record.id, { valid_from: daysFromNow(10) });

		const page = await pageAs(browser, claimer);
		try {
			await gotoHydrated(page, claimPath);
			await waitForClientAuth(page);
			await page.getByRole('button', { name: 'Link to my account' }).click();

			await expect(
				page.getByRole('heading', { name: "We couldn't link this membership" })
			).toBeVisible({ timeout: 20_000 });
			await expect(
				page.getByText("This membership hasn't started yet. Try the link again once it has.")
			).toBeVisible();
		} finally {
			await page.context().close();
		}
	});
});
