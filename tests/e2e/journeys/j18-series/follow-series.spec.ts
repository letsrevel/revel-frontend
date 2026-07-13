import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J18 (USER_JOURNEYS.md) — following an event series: the Follow button on
// the public series page, the followed series surfacing under
// /dashboard/following → Event Series, and unfollowing from there.
//
// The round-trip test uses a THROWAWAY user so parallel projects never race
// on the same follow row and a crashed run leaves no state behind. The
// seeded-follow test reads hannah's bootstrap-seeded follow of
// monthly-tech-talks and never mutates it.

const SERIES_PATH = '/events/tech-innovators-network/series/monthly-tech-talks';
const SERIES_NAME = 'Monthly Tech Talks';

test.describe('J18 follow series @p2', () => {
	test('follow on the series page → dashboard following → unfollow → empty state', async ({
		browser
	}) => {
		const user = await createVerifiedUser('SeriesFollow');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, SERIES_PATH);
		await waitForClientAuth(page);

		await page.getByRole('button', { name: 'Follow', exact: true }).click();
		await expect(page.getByText(`You are now following ${SERIES_NAME}`)).toBeVisible({
			timeout: 15_000
		});
		// The button flips into the "Following" dropdown trigger.
		await expect(page.getByRole('button', { name: 'Following', exact: true })).toBeVisible();

		// The followed series shows up under /dashboard/following → Event Series.
		await gotoHydrated(page, '/dashboard/following');
		await waitForClientAuth(page);
		await page.getByRole('button', { name: /Event Series/ }).click();
		const seriesLink = page.getByRole('link', { name: SERIES_NAME });
		await expect(seriesLink).toBeVisible({ timeout: 15_000 });

		// Unfollow from the dashboard card → the list empties out.
		await page.getByRole('button', { name: 'Unfollow' }).click();
		await expect(page.getByText(`You have unfollowed ${SERIES_NAME}`)).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText("You're not following any event series yet")).toBeVisible({
			timeout: 15_000
		});

		await context.close();
	});

	test('a seeded follow lists the series and links back to its page', async ({ asUser }) => {
		// hannah follows monthly-tech-talks via the bootstrap seed — read-only.
		await gotoHydrated(asUser, '/dashboard/following');
		await waitForClientAuth(asUser);

		await expect(asUser.getByRole('heading', { name: 'Following', level: 1 })).toBeVisible();
		await asUser.getByRole('button', { name: /Event Series/ }).click();

		const seriesLink = asUser.getByRole('link', { name: SERIES_NAME });
		await expect(seriesLink).toBeVisible({ timeout: 15_000 });
		await seriesLink.click();
		await asUser.waitForURL(/\/series\/monthly-tech-talks$/);
		await expect(asUser.getByRole('heading', { name: SERIES_NAME, level: 1 })).toBeVisible();
		// Her own follow renders as the "Following" state on the series page.
		await expect(asUser.getByRole('button', { name: 'Following', exact: true })).toBeVisible();
	});
});
