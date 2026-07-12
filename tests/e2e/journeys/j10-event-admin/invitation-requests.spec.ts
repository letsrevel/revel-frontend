import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser, rsvpViaApi } from '../../support/factories';
import { ApiClient, ApiError } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10 invitation requests — a private event with accept_invitation_requests
// gates strangers behind "Request Invitation"; the admin decides on the
// Manage Invitations page (default ?tab=requests).
//
// Backend contract: approve takes NO tier — it's a bare POST on the request
// id (spec drift confirmed in recon: the tier picker some journeys mention
// does not exist). Approval grants an invitation, which we prove by the
// requester's RSVP succeeding via the API while the rejected user stays 400.
//
// Admin decision feedback is an inline role=alert banner, NOT a toast.

test.describe('J10 invitation requests @p2', () => {
	test('user requests an invitation; admin approves and rejects', async ({ asOwner, browser }) => {
		const [event, requester, rejectedUser] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: {
					requires_ticket: false,
					event_type: 'private',
					accept_invitation_requests: true
				}
			}),
			createVerifiedUser('Requester'),
			createVerifiedUser('Rejected')
		]);
		const requesterName = `${requester.firstName} ${requester.lastName}`;
		const rejectedName = `${rejectedUser.firstName} ${rejectedUser.lastName}`;

		// The requester asks through the UI (dialog with optional message).
		const requesterContext = await browser.newContext();
		await authenticateContext(requesterContext, requester);
		const requesterPage = await requesterContext.newPage();
		await gotoHydrated(requesterPage, event.path);
		await waitForClientAuth(requesterPage);
		await requesterPage.getByRole('button', { name: 'Request Invitation' }).click();
		const requestDialog = requesterPage.getByRole('dialog', { name: 'Request Invitation' });
		await requestDialog
			.getByLabel('Message (Optional)')
			.fill('E2E: please let me in, I love private events.');
		await requestDialog.getByRole('button', { name: 'Submit Request' }).click();
		await expect(requesterPage.getByText('Request Submitted')).toBeVisible({ timeout: 15_000 });
		// The dialog auto-closes (~2s) and onInvitationRequestSuccess refreshes
		// eligibility → next_step wait_for_invitation_approval renders the
		// disabled "Pending Approval" gate (this refresh was broken on the
		// RSVP path before this PR — the callback chain stopped at EventRSVP).
		const pendingButton = requesterPage.getByRole('button', { name: 'Pending Approval' });
		await expect(pendingButton).toBeVisible({ timeout: 15_000 });
		await expect(pendingButton).toBeDisabled();

		// The second request arrives via the API.
		const rejectedApi = await ApiClient.login(rejectedUser.email, rejectedUser.password);
		await rejectedApi.post(`/api/events/${event.id}/invitation-requests`, {
			message: 'E2E: reject me'
		});

		// Admin: approve one, reject the other (plain table rows, no tier picker).
		const page = asOwner;
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/invitations`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Manage Invitations', level: 1 })).toBeVisible();

		const rowFor = (name: string) => page.getByRole('row').filter({ hasText: name });
		await expect(rowFor(requesterName)).toBeVisible({ timeout: 15_000 });
		await rowFor(requesterName).getByRole('button', { name: 'Approve' }).click();
		await expect(page.getByText('Request approved successfully.')).toBeVisible({
			timeout: 15_000
		});
		// Both the status badge and the actions cell read "Approved".
		await expect(rowFor(requesterName).getByText('Approved').first()).toBeVisible();

		await rowFor(rejectedName).getByRole('button', { name: 'Reject' }).click();
		await expect(page.getByText('Request rejected successfully.')).toBeVisible({
			timeout: 15_000
		});
		await expect(rowFor(rejectedName).getByText('Rejected').first()).toBeVisible();

		// The approval granted a real invitation: the requester can now RSVP
		// to the private event; the rejected user still can't.
		await rsvpViaApi(requester, event.id, 'yes');
		await expect(rsvpViaApi(rejectedUser, event.id, 'yes')).rejects.toThrowError(ApiError);

		await requesterContext.close();
	});
});
