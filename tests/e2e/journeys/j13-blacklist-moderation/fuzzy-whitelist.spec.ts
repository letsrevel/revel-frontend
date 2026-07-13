import { test, expect } from '../../support/fixtures';
import {
	addToBlacklist,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J13 (USER_JOURNEYS.md) — fuzzy blacklist match → whitelist request →
// approval → unblocked. A NAME-ONLY (unlinked) blacklist entry soft-matches
// users by rapidfuzz name similarity: unlike a hard match (which 404s the
// org's events outright), the fuzzy-matched user still reaches the event and
// gets the "Additional verification required." gate with a Request
// Verification action. Approving the request on the admin's Verification
// Requests tab unblocks them immediately.
//
// Isolation: throwaway org + throwaway user; the entry carries only the
// user's name (adding their email would auto-link it into a HARD block).

test.describe('J13 fuzzy whitelist @p3', () => {
	test('name-match gate → request verification → approve → unblocked', async ({ browser }) => {
		test.setTimeout(180_000);

		const org = await createOrganization();
		const visitor = await createVerifiedUser('Fuzzy');
		// Name-only entry, identical to the visitor's name (fuzzy threshold 85).
		await addToBlacklist(org.owner, org.slug, {
			first_name: visitor.firstName,
			last_name: visitor.lastName,
			reason: 'E2E fuzzy-whitelist journey'
		});
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});

		// The fuzzy-matched visitor sees the verification gate, not a 404.
		const visitorContext = await browser.newContext();
		await authenticateContext(visitorContext, visitor);
		const visitorPage = await visitorContext.newPage();
		await gotoHydrated(visitorPage, event.path);
		await waitForClientAuth(visitorPage);
		await expect(
			visitorPage.getByText('Additional verification required.').filter({ visible: true }).first()
		).toBeVisible({ timeout: 15_000 });
		await expect(visitorPage.getByRole('heading', { name: 'Will you attend?' })).toBeHidden();

		// Submit the whitelist request through the dialog.
		await visitorPage
			.getByRole('button', { name: 'Request Verification' })
			.filter({ visible: true })
			.first()
			.click();
		const requestDialog = visitorPage.getByRole('dialog', { name: 'Request Verification' });
		await expect(requestDialog).toBeVisible();
		await requestDialog
			.getByLabel('Message (Optional)')
			.fill('The organizers know me — this is a name collision.');
		await requestDialog.getByRole('button', { name: 'Submit Request' }).click();
		await expect(visitorPage.getByText('Verification Request Submitted').first()).toBeVisible({
			timeout: 15_000
		});

		// Reloading, the gate now shows the pending state (disabled action).
		await gotoHydrated(visitorPage, event.path);
		const pendingButton = visitorPage
			.getByRole('button', { name: 'Verification Pending' })
			.filter({ visible: true })
			.first();
		await expect(pendingButton).toBeVisible({ timeout: 15_000 });
		await expect(pendingButton).toBeDisabled();

		// The owner approves it from the blacklist page's Verification Requests tab.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/blacklist`);
		await waitForClientAuth(ownerPage);
		await ownerPage.getByRole('tab', { name: /Verification Requests|Requests/ }).click();
		// exact: true everywhere — role-name matching is SUBSTRING by default,
		// and the tab's "Approved" FILTER button would match a bare 'Approve'
		// (the tab switches itself to that filter after a decision, so the
		// approved card + filter button otherwise keep the locator alive).
		const requestCard = ownerPage
			.locator('article, li, div')
			.filter({ hasText: `${visitor.firstName} ${visitor.lastName}` })
			.filter({ has: ownerPage.getByRole('button', { name: 'Approve', exact: true }) })
			.last();
		await expect(requestCard).toBeVisible({ timeout: 15_000 });
		// Outcome-keyed approve with a DISPATCHED click — on the mobile project
		// the card button intermittently never settles for Playwright's
		// actionability check and a positioned click hangs (same class as the
		// invoice-detail dialog). Approval removes the card from the "Pending"
		// filter, so the card locator — which requires an exact Approve button —
		// resolving to nothing IS the success state; re-dispatch is harmless
		// (the endpoint 400s only after the request already left pending).
		const approveButton = requestCard.getByRole('button', { name: 'Approve', exact: true });
		await expect(async () => {
			if (await approveButton.isHidden()) return;
			await approveButton.dispatchEvent('click');
			await expect(approveButton).toBeHidden({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		// Approval unblocks immediately: the gate is gone, the RSVP card renders.
		await expect(async () => {
			await gotoHydrated(visitorPage, event.path);
			await expect(visitorPage.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
				timeout: 3_000
			});
		}).toPass({ timeout: 30_000 });
		await expect(visitorPage.getByText('Additional verification required.')).toBeHidden();

		await visitorContext.close();
		await ownerContext.close();
	});
});
