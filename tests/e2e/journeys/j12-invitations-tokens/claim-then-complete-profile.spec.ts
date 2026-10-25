import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { createEventToken, createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';

// Invitation claim loop (PR #1115). The backend checks InvitationGate before
// FullProfileGate, and the httpOnly `pending_event_token` cookie (set from
// `?et=`) survives the claim reload. Before the fix a granting token always
// rendered "Claim Invitation", so a user whose NEXT blocker was a missing
// profile was asked to claim again and again. Once the invitation is held the
// page must show the step that actually blocks: "Complete Profile".
//
// A throwaway user has no profile picture or pronouns, so an event with
// `requires_full_profile` answers next_step "complete_profile" for them.
//
// Not exercised here: the backend actually mutating the profile. The CTA is
// asserted to navigate to /account/profile with a redirect back to the event.

const CLAIM = 'Claim Invitation';
const COMPLETE_PROFILE = 'Complete Profile';

test.describe('J12 invitation claim then complete profile @p1', () => {
	test('private event: claim once, then Complete Profile replaces the claim button', async ({
		browser
	}) => {
		test.setTimeout(120_000);

		const [event, user] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: {
					event_type: 'private',
					visibility: 'private',
					requires_ticket: false,
					requires_full_profile: true
				}
			}),
			createVerifiedUser('ClaimLoop')
		]);
		const token = await createEventToken(event.id);

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, `${event.path}?et=${token.id}`);
			await waitForClientAuth(page);

			// Invitation gate is the blocker: the claim is on offer, the profile CTA is not.
			const claim = page.getByRole('button', { name: CLAIM });
			await expect(claim).toBeVisible({ timeout: 15_000 });
			await expect(page.getByRole('button', { name: COMPLETE_PROFILE })).toHaveCount(0);

			await claim.click();

			// The claim strips ?et= and reloads; the cookie keeps the token alive,
			// which is exactly what used to resurrect the claim button.
			await page.waitForURL((url) => !url.searchParams.has('et'), { timeout: 15_000 });
			await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
			await waitForClientAuth(page);

			const profile = page.getByRole('button', { name: COMPLETE_PROFILE });
			await expect(profile).toBeVisible({ timeout: 15_000 });
			await expect(page.getByRole('button', { name: CLAIM })).toHaveCount(0);

			// Reloading again must not bring the claim back either.
			await page.reload();
			await expect(page.getByRole('button', { name: COMPLETE_PROFILE })).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByRole('button', { name: CLAIM })).toHaveCount(0);

			// And the CTA does what it says.
			await page.getByRole('button', { name: COMPLETE_PROFILE }).click();
			await page.waitForURL(/\/account\/profile\?redirect=/, { timeout: 15_000 });
			expect(new URL(page.url()).searchParams.get('redirect')).toBe(event.path);
		} finally {
			await context.close();
		}
	});

	test('public event: a granting link never hides the Complete Profile CTA', async ({
		browser
	}) => {
		test.setTimeout(120_000);

		const [event, user] = await Promise.all([
			createTicketedEvent({
				freeTier: false,
				event: { requires_ticket: false, requires_full_profile: true }
			}),
			createVerifiedUser('ClaimLoopPublic')
		]);
		const token = await createEventToken(event.id);

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, `${event.path}?et=${token.id}`);
			await waitForClientAuth(page);

			// No invitation is needed to get in, so nothing to claim: the profile
			// step is the only action offered.
			await expect(page.getByRole('button', { name: COMPLETE_PROFILE })).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByRole('button', { name: CLAIM })).toHaveCount(0);
		} finally {
			await context.close();
		}
	});
});
