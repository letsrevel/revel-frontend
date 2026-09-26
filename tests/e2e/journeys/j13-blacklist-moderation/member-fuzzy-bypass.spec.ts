import { test, expect } from '../../support/fixtures';
import {
	addToBlacklist,
	approveMembershipRequest,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	requestMembership,
	type ThrowawayUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J13.5 (USER_JOURNEYS.md) — member bypass. A NAME-ONLY blacklist entry
// fuzzy-matches everyone with that name and puts them behind the
// "Additional verification required." gate (see fuzzy-whitelist.spec.ts) —
// except ACTIVE members of the org, who are trusted and skip fuzzy matching
// entirely (event_manager BlacklistGate). Only a hard (linked / identifier)
// entry blocks a member.
//
// Two throwaway users with the SAME name (createVerifiedUser names them
// "E2E <label>"): one is an active member, the other an outsider. Same name,
// same entry, same event — the only variable is membership.
//
// Isolation: throwaway org (open to requests so the member can be approved),
// throwaway users; the entry carries only the shared name.

async function openEventAs(
	browser: import('@playwright/test').Browser,
	user: ThrowawayUser,
	path: string
) {
	const context = await browser.newContext();
	await authenticateContext(context, user);
	const page = await context.newPage();
	await gotoHydrated(page, path);
	await waitForClientAuth(page);
	return { context, page };
}

test.describe('J13 active members bypass fuzzy blacklist matches @p2', () => {
	test('same-named member reaches the RSVP card; the outsider hits the verification gate', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization({
			acceptMembershipRequests: true,
			publicVisibility: true
		});
		const [member, outsider] = await Promise.all([
			createVerifiedUser('Namesake'),
			createVerifiedUser('Namesake')
		]);
		expect(`${member.firstName} ${member.lastName}`).toBe(
			`${outsider.firstName} ${outsider.lastName}`
		);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		// Name-only entry (no email/phone/telegram → never auto-links).
		await addToBlacklist(org.owner, org.slug, {
			first_name: member.firstName,
			last_name: member.lastName,
			reason: 'E2E member-bypass journey'
		});
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});

		// Control: the non-member namesake is gated.
		const outsiderView = await openEventAs(browser, outsider, event.path);
		try {
			await expect(
				outsiderView.page
					.getByText('Additional verification required.')
					.filter({ visible: true })
					.first()
			).toBeVisible({ timeout: 15_000 });
			await expect(
				outsiderView.page.getByRole('heading', { name: 'Will you attend?' })
			).toBeHidden();
		} finally {
			await outsiderView.context.close();
		}

		// The active member with the identical name is not.
		const memberView = await openEventAs(browser, member, event.path);
		try {
			const { page } = memberView;
			await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByText('Additional verification required.')).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Request Verification' })).toHaveCount(0);
		} finally {
			await memberView.context.close();
		}
	});
});
