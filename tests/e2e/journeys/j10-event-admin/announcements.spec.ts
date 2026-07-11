import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';

// J10.8 (USER_JOURNEYS.md) — announcements (org-level, event-targetable):
// draft → send → email delivered to the member; schedule → unschedule →
// back to drafts. Recipient counts render post-send on the card.
//
// Isolation: throwaway-owned org with ONE approved member (the email
// recipient), so "All Members" has a deterministic audience of 1.

test.describe('J10 announcements @p1', () => {
	test('draft → send (member gets email); schedule → unschedule', async ({ browser }) => {
		test.setTimeout(150_000);
		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Reader')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/announcements`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Announcements' }).first()).toBeVisible();

		// ---- Draft → Send ----
		const sentTitle = uniqueName('News');
		const modal = page.getByRole('dialog', { name: /New Announcement|Edit Announcement/ });
		await page.getByRole('button', { name: 'New Announcement' }).first().click();
		await expect(modal).toBeVisible();
		await modal.getByLabel('Title').fill(sentTitle);
		await modal.locator('[contenteditable="true"]').fill('Hello members — E2E announcement.');
		await modal.getByRole('button', { name: 'All Members' }).click();
		await modal.getByRole('button', { name: 'Save Draft' }).click();
		await expect(modal).not.toBeVisible({ timeout: 20_000 });

		// The draft card exposes Send → confirm dialog → lands in Sent.
		await page.getByRole('tab', { name: 'Drafts' }).click();
		const draftCard = page.locator('article, li, div').filter({ hasText: sentTitle }).first();
		await expect(draftCard).toBeVisible({ timeout: 15_000 });
		await draftCard.getByRole('button', { name: 'Send', exact: true }).click();
		const sendConfirm = page.getByRole('dialog', { name: 'Send Announcement?' });
		await sendConfirm.getByRole('button', { name: 'Send', exact: true }).click();
		await expect(sendConfirm).not.toBeVisible({ timeout: 20_000 });
		await page.getByRole('tab', { name: 'Sent' }).click();
		await expect(page.getByText(sentTitle).filter({ visible: true }).first()).toBeVisible({
			timeout: 20_000
		});

		// The member receives the announcement email (Celery runs eagerly in dev).
		const email = await waitForEmail({ to: member.email, subject: sentTitle.slice(0, 20) });
		expect(email.Subject).toContain(sentTitle.slice(0, 20));

		// ---- Schedule → Unschedule ----
		const scheduledTitle = uniqueName('Later');
		const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
		const sendAtValue = `${tomorrow.toISOString().slice(0, 11)}10:00`;
		await page.getByRole('button', { name: 'New Announcement' }).first().click();
		await expect(modal).toBeVisible();
		await modal.getByLabel('Title').fill(scheduledTitle);
		await modal.locator('[contenteditable="true"]').fill('Scheduled body — E2E.');
		await modal.getByRole('button', { name: 'All Members' }).click();
		await modal.getByRole('radio', { name: 'Schedule' }).check();
		await modal.getByLabel('Send at').fill(sendAtValue);
		await modal.getByRole('button', { name: 'Schedule', exact: true }).click();
		await expect(modal).not.toBeVisible({ timeout: 20_000 });

		await page.getByRole('tab', { name: 'Scheduled' }).click();
		const scheduledCard = page
			.locator('article, li, div')
			.filter({ hasText: scheduledTitle })
			.first();
		await expect(scheduledCard).toBeVisible({ timeout: 20_000 });
		await scheduledCard.getByRole('button', { name: 'Unschedule' }).click();
		// The card only disappears after the server confirms (onSuccess →
		// invalidate). Wait for the completion toast before navigating — a
		// reload can otherwise abort the still-pending unschedule request.
		await expect(page.getByText('Moved back to draft')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText(scheduledTitle).filter({ visible: true })).toHaveCount(0, {
			timeout: 20_000
		});
		// The move back to Drafts can need a fresh load on slower refetches.
		// Each reload re-runs the client auth bootstrap and the list query
		// stays disabled until the token arrives — wait for it every pass.
		await expect(async () => {
			await gotoHydrated(page, `/org/${org.slug}/admin/announcements`);
			await waitForClientAuth(page);
			await page.getByRole('tab', { name: 'Drafts' }).click({ timeout: 3_000 });
			await expect(page.getByText(scheduledTitle).filter({ visible: true }).first()).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 90_000 });

		await context.close();
	});
});
