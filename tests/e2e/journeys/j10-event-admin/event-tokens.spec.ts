import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J10.7 (USER_JOURNEYS.md) — event invitation links: owner creates a
// grants-invitation link in the UI; a logged-in user opens the shared
// /join/event/<code> page and claims → an invitation exists for them.
//
// Expired/used-up tokens answer 410 with reason-specific guidance
// (revel-backend#681) — covered by j01 token-preview.

test.describe('J10 event tokens @p1', () => {
	test('create link in UI → claim on join page → invitation granted', async ({
		asOwner,
		browser
	}) => {
		test.setTimeout(120_000);
		const [event, claimer] = await Promise.all([
			createTicketedEvent(),
			createVerifiedUser('EventClaimer')
		]);

		const page = asOwner;
		// Tab state is a URL param — navigate straight to the Links tab.
		await gotoHydrated(
			page,
			`/org/${event.orgSlug}/admin/events/${event.id}/invitations?tab=links`
		);
		await waitForClientAuth(page);

		await page.getByRole('button', { name: 'Create Link' }).click();
		const createModal = page.getByRole('dialog', { name: 'Create Invitation Link' });
		await expect(createModal).toBeVisible();
		await createModal.getByLabel('Name (optional)').fill('E2E event link');
		await createModal.getByLabel('Grant invitation (allows users to RSVP or buy tickets)').check();
		await createModal.getByRole('button', { name: 'Create Link' }).click();
		await expect(page.getByText(/Invitation link created successfully/)).toBeVisible({
			timeout: 15_000
		});

		// The share URL is the public /join/event/<code> page.
		await page.getByRole('button', { name: 'Share token' }).click();
		const shareDialog = page.getByRole('dialog', { name: 'Share Invitation Link' });
		const shareUrl = await shareDialog.getByLabel('Shareable URL').inputValue();
		const sharePath = new URL(shareUrl).pathname;
		expect(sharePath, `share URL is the join page: ${shareUrl}`).toContain('/join/event/');
		await closeDialog(page, shareDialog);

		// A logged-in user opens the join page and claims the invitation.
		const claimerContext = await browser.newContext();
		await authenticateContext(claimerContext, claimer);
		const claimerPage = await claimerContext.newPage();
		await gotoHydrated(claimerPage, sharePath);
		await waitForClientAuth(claimerPage);
		await expect(claimerPage.getByText("You've been invited!")).toBeVisible();
		await expect(claimerPage.getByText(event.name).first()).toBeVisible();
		await claimerPage.getByRole('button', { name: 'Claim Invitation' }).click();
		await expect(claimerPage.getByText(`You've been invited to ${event.name}!`)).toBeVisible({
			timeout: 15_000
		});

		// The owner sees the claimer in the direct-invitations table.
		const claimerName = `${claimer.firstName} ${claimer.lastName}`;
		await gotoHydrated(
			page,
			`/org/${event.orgSlug}/admin/events/${event.id}/invitations?tab=invitations`
		);
		await expect(page.getByText(claimerName).first()).toBeVisible({ timeout: 20_000 });

		await claimerContext.close();
	});
});
