import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { createTicketedEvent, createTicketTier, deleteDefaultTier } from '../../support/factories';

// Prod incident 2026-09-04 ("Kitts Meets") regression guard, part 2: the tier
// listing reports can_purchase: false to anonymous visitors on an
// invited-only tier, but TierCard only honoured it when tierRemainingInfo
// (authenticated my-status data) existed — so a logged-out guest on a
// can_attend_without_login event saw an ENABLED CTA and a checkout that died
// later. The card must render a disabled action with a visible reason, and
// no quick-buy stepper.

test.describe('J7 anonymous invited-tier gating @p2', () => {
	test('an invited-only tier renders no enabled action for a logged-out guest', async ({
		page
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { can_attend_without_login: true, require_ticket_names: false }
		});
		await deleteDefaultTier(event.id); // its public stepper would also render
		const tier = await createTicketTier(event.id, {
			name: 'Inner Circle',
			purchasable_by: 'invited',
			payment_method: 'free',
			price: '0.00'
		});

		await gotoHydrated(page, event.path);

		// The tier is listed (public visibility) but not purchasable.
		await expect(page.getByText(tier.name)).toBeVisible({ timeout: 15_000 });
		const notEligible = page.getByRole('button', { name: 'Not Eligible' });
		await expect(notEligible).toBeVisible();
		await expect(notEligible).toBeDisabled();
		await expect(page.getByText('Not Available', { exact: true })).toBeVisible();
		// No purchase path of any kind.
		await expect(page.getByRole('group', { name: `Quantity for ${tier.name}` })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Claim Free Ticket' })).toHaveCount(0);
	});
});
