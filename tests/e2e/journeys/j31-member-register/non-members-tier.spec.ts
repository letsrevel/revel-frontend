import { test, expect } from '../../support/fixtures';
import { ApiError } from '../../support/api';
import {
	approveMembershipRequest,
	claimTicketViaApi,
	createOrganization,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// FE #1168 (BE#1316): a ticket tier can be "non-members only". It stays listed
// for an active member, but shows "Not available to members" with a way out
// (choose another tier) and checkout refuses; a non-member buys it normally.

test.describe('J31 non-members-only tier @p2', () => {
	test('an active member is told it is not for members and cannot buy it; a non-member can', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization({
			acceptMembershipRequests: true,
			publicVisibility: true
		});
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false
		});
		const tier = await createTicketTier(
			event.id,
			{
				name: 'Guests only',
				payment_method: 'free',
				price: '0.00',
				purchasable_by: 'non_members'
			},
			org.owner
		);
		const member = await createVerifiedUser('ActiveMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const outsider = await createVerifiedUser('Outsider');

		// Member: disabled button + the hint, and the API agrees.
		const memberPage = await pageAs(browser, member);
		try {
			await gotoHydrated(memberPage, event.path);
			await waitForClientAuth(memberPage);
			const blocked = memberPage
				.getByRole('button', { name: 'Not available to members' })
				.filter({ visible: true });
			await expect(blocked).toBeVisible({ timeout: 15_000 });
			await expect(blocked).toBeDisabled();
			await expect(
				memberPage
					.getByText("This tier isn't available to members. Choose another tier.")
					.filter({ visible: true })
			).toBeVisible();
		} finally {
			await memberPage.context().close();
		}
		await expect(claimTicketViaApi(member, event.id, tier.id)).rejects.toBeInstanceOf(ApiError);

		// Non-member: the tier is purchasable.
		const outsiderPage = await pageAs(browser, outsider);
		try {
			await gotoHydrated(outsiderPage, event.path);
			await waitForClientAuth(outsiderPage);
			await expect(
				outsiderPage.getByText('Guests only').filter({ visible: true }).first()
			).toBeVisible({ timeout: 15_000 });
			await expect(
				outsiderPage.getByRole('button', { name: 'Not available to members' })
			).toHaveCount(0);
		} finally {
			await outsiderPage.context().close();
		}
		const ticket = await claimTicketViaApi(outsider, event.id, tier.id);
		expect(ticket.status).toBe('active');
	});
});
