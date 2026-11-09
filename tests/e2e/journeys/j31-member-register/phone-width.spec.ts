import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createVerifiedUser,
	uniqueEmail,
	uniqueName
} from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	claimPathFromLink,
	createRegisterEntry,
	hasHorizontalOverflow,
	inviteRegisterEntry,
	registerEntry,
	registerPath
} from '../../support/member-register';

// Phone-width regression checks for the new member-register surfaces. The
// persona fixtures open desktop-sized contexts regardless of the Playwright
// project, so these specs create their own 375x667 contexts and run on both.

const PHONE = { width: 375, height: 667 };

test.describe('J31 phone width @p2', () => {
	test('the invite claim page and the register list do not scroll sideways', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization();
		const longName = `${uniqueName('Maximiliana')} Featherstonehaugh-Cholmondeley`;
		const longEmail = uniqueEmail('a-rather-long-mailbox-name-to-stress-the-layout');
		const record = await createRegisterEntry(org.owner, org.slug, {
			fullName: longName,
			email: longEmail,
			tierId: org.defaultTierId
		});
		await inviteRegisterEntry(org.owner, org.slug, record.id);
		const invite = await waitForEmail({ to: longEmail });
		const claimPath = claimPathFromLink(extractLink(invite, /\/member-invite\//));
		const claimer = await createVerifiedUser('PhoneClaimer');

		// Claim page, signed out (log in / create account) and signed in (confirm).
		const anonymous = await browser.newContext({ viewport: PHONE });
		const signedOut = await anonymous.newPage();
		try {
			await gotoHydrated(signedOut, claimPath);
			await expect(signedOut.getByRole('link', { name: 'Create account' })).toBeVisible();
			expect(await hasHorizontalOverflow(signedOut)).toBe(false);
		} finally {
			await anonymous.close();
		}

		const claimerContext = await browser.newContext({ viewport: PHONE });
		await authenticateContext(claimerContext, claimer);
		const signedIn = await claimerContext.newPage();
		try {
			await gotoHydrated(signedIn, claimPath);
			await waitForClientAuth(signedIn);
			await expect(signedIn.getByRole('button', { name: 'Link to my account' })).toBeVisible({
				timeout: 15_000
			});
			expect(await hasHorizontalOverflow(signedIn)).toBe(false);
		} finally {
			await claimerContext.close();
		}

		// Register list (cards below md) with the long name and address.
		const ownerContext = await browser.newContext({ viewport: PHONE });
		await authenticateContext(ownerContext, org.owner);
		const list = await ownerContext.newPage();
		try {
			await gotoHydrated(list, registerPath(org.slug));
			await waitForClientAuth(list);
			await expect(registerEntry(list, longName)).toBeVisible({ timeout: 15_000 });
			expect(await hasHorizontalOverflow(list)).toBe(false);
		} finally {
			await ownerContext.close();
		}
	});
});
