import { test, expect } from '../../support/fixtures';
import { createPoll } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J24 (USER_JOURNEYS.md) — poll duplication: cloning an OPEN poll from the
// admin list produces a DRAFT copy with its lifecycle reset (open/close
// timestamps cleared, votes not carried over), leaving the source untouched.
//
// The duplicate modal prefills "Copy of {name}" and — success has NO toast —
// navigates straight to the clone's detail page; the test asserts the URL
// flips to a different poll id and the clone offers "Open poll" (draft) while
// the source still shows as Open on the list.

const ORG_SLUG = 'revel-events-collective';

test.describe('J24 poll duplicate @p3', () => {
	test('duplicate an open poll → draft clone with lifecycle reset', async ({ asOwner: page }) => {
		const poll = await createPoll({ open: true });

		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/polls`);
		await waitForClientAuth(page);

		// The list accumulates polls across runs — scope to THIS poll's card via
		// its unique name before reaching for its actions menu.
		const card = page
			.locator('article, li, div')
			.filter({ hasText: poll.name })
			.filter({ has: page.getByRole('button', { name: 'More actions' }) })
			.last();
		await expect(card).toBeVisible({ timeout: 15_000 });
		await card.getByRole('button', { name: 'More actions' }).click();
		await page.getByRole('menuitem', { name: 'Duplicate' }).click();

		// Modal: the name field is prefilled with the FE default "Copy of {name}".
		const modal = page.getByRole('dialog', { name: 'Duplicate Poll' });
		await expect(modal).toBeVisible();
		const cloneName = `Copy of ${poll.name}`;
		await expect(modal.getByLabel('New Poll Name')).toHaveValue(cloneName);

		// Success navigates to the clone's detail page (no toast) — a different
		// poll id than the source.
		await modal.getByRole('button', { name: 'Duplicate', exact: true }).click();
		await page.waitForURL(
			(url) =>
				/\/admin\/polls\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(poll.id),
			{ timeout: 20_000 }
		);

		// The clone is a DRAFT with its lifecycle reset: it can be opened, and
		// the questions came along (deep copy).
		await expect(page.getByText(cloneName).first()).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByText('Draft', { exact: true }).filter({ visible: true }).first()
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Open poll' })).toBeVisible();
		await expect(page.getByText('Are you in?').first()).toBeVisible();

		// The source poll is untouched — still listed as Open.
		await gotoHydrated(page, `/org/${ORG_SLUG}/admin/polls`);
		const sourceCard = page
			.locator('article, li, div')
			.filter({ hasText: poll.name })
			.filter({ hasText: /Open/ })
			.filter({ has: page.getByRole('button', { name: 'More actions' }) })
			.last();
		await expect(sourceCard).toBeVisible({ timeout: 15_000 });
	});
});
