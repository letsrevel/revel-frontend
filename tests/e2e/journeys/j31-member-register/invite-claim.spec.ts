import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueEmail, uniqueName } from '../../support/factories';
import { fillRegistrationForm } from '../../support/auth-forms';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	claimPathFromLink,
	createRegisterEntry,
	inviteRegisterEntry,
	listRegisterEntries,
	registerEntry,
	registerPath
} from '../../support/member-register';

// Member register epic (revel-backend#1317, FE #1171): a register entry is
// invited by email, and the person claims it from the emailed link, with a
// DIFFERENT email than the invitation's. The claim is an explicit confirm,
// never an auto-link on page load, and the target survives registration and
// email verification via `?returnUrl=`.

const STRONG_PASSWORD = 'E2e-test-Pass!123';

test.describe('J31 member invite claim with a different email @p1', () => {
	test('register with another email, verify, land back on the invite, confirm, and the entry reads Linked', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization();
		const inviteeName = uniqueName('Invitee');
		const invitedEmail = uniqueEmail('Invited');
		const claimerEmail = uniqueEmail('Claimer');

		const record = await createRegisterEntry(org.owner, org.slug, {
			fullName: inviteeName,
			email: invitedEmail,
			tierId: org.defaultTierId
		});
		await inviteRegisterEntry(org.owner, org.slug, record.id);
		const invite = await waitForEmail({ to: invitedEmail });
		const claimPath = claimPathFromLink(extractLink(invite, /\/member-invite\//));

		const visitor = await browser.newContext();
		const page = await visitor.newPage();
		try {
			// Signed out: the preview names the entry; nothing is claimed by looking.
			await gotoHydrated(page, claimPath);
			await expect(page.getByTestId('member-invite-entry')).toHaveText(inviteeName);
			await expect(page.getByRole('button', { name: 'Link to my account' })).toHaveCount(0);

			await page.getByRole('link', { name: 'Create account' }).click();
			await page.waitForURL(/\/register\?.*returnUrl=/);
			await fillRegistrationForm(page, claimerEmail, STRONG_PASSWORD, {
				startAt: `${new URL(page.url()).pathname}${new URL(page.url()).search}`
			});
			await page.getByRole('button', { name: 'Create your account' }).click();
			await page.waitForURL(/\/register\/check-email/);

			// The verification link carries the invite path through (no auto-claim yet).
			const verification = await waitForEmail({ to: claimerEmail });
			const link = extractLink(verification, /token=/);
			expect(link).toContain('returnUrl=%2Fmember-invite%2F');
			await page.goto(link);
			await page.waitForURL(/\/member-invite\//);
			await waitForClientAuth(page);

			// Back on the invite, signed in with an email that is NOT the invited one.
			await expect(page.getByText(`You're signed in as ${claimerEmail}`)).toBeVisible({
				timeout: 15_000
			});
			expect((await listRegisterEntries(org.owner, org.slug))[0]?.invite_status).not.toBe('linked');

			await page.getByRole('button', { name: 'Link to my account' }).click();
			await expect(page.getByRole('heading', { name: 'Membership linked' })).toBeVisible({
				timeout: 20_000
			});
			await expect(page.getByText(`for ${org.name} is now linked to your account`)).toBeVisible();
		} finally {
			await visitor.close();
		}

		// Staff view: the same entry is now Linked.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		try {
			await gotoHydrated(ownerPage, registerPath(org.slug));
			await waitForClientAuth(ownerPage);
			const entry = registerEntry(ownerPage, inviteeName);
			await expect(entry).toBeVisible({ timeout: 15_000 });
			await expect(entry.getByTestId('register-badge-linked')).toBeVisible();
			await expect(entry.getByTestId('register-badge-no-account')).toHaveCount(0);
		} finally {
			await ownerContext.close();
		}
	});
});
