import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createEventSeries,
	createOrganization
} from '../../support/factories';
import { pageAs } from '../../support/session';

/**
 * #756 / backend #849 — Stripe success/cancel URLs carry UUIDs instead of
 * slugs; the matching FE routes resolve them and 303 to the canonical slug
 * URL, forwarding the query string verbatim. These specs drive the redirect
 * directly (no Stripe): the full checkout loop is covered by the existing
 * j06/j23 journeys once the backend emits UUID return URLs.
 *
 * Query-preservation is asserted with an inert `e2e_probe` param on purpose:
 * the real payment_success/membership_success flags are consumed (stripped
 * from the URL) by the landing pages, which would race these URL asserts.
 */

// Valid v4-shaped UUID that matches no object.
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * `toHaveURL` with a plain string requires an exact match; slugged paths are
 * plain dash-case (no regex metacharacters) but the origin still needs to be
 * resolved against baseURL, so match the house pattern (subscribe-online.spec.ts)
 * of anchoring a RegExp at the end of the URL instead.
 */
function endsWith(path: string): RegExp {
	return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

test.describe('UUID → slug redirects (Stripe opaque returns) @p1', () => {
	test('event UUID path 303s to the slug URL with query intact', async ({ page }) => {
		const event = await createTicketedEvent();
		await page.goto(`/events/${UNKNOWN_UUID}/${event.id}?e2e_probe=1`);
		await expect(page).toHaveURL(endsWith(`${event.path}?e2e_probe=1`));
		await expect(page.getByRole('heading', { name: event.name })).toBeVisible();
	});

	test('series UUID path 303s to the slug URL with query intact', async ({ page }) => {
		const org = await createOrganization({ publicVisibility: true });
		const series = await createEventSeries(org.owner, org.slug);
		await page.goto(`/events/${org.id}/series/${series.id}?e2e_probe=1`);
		await expect(page).toHaveURL(endsWith(`${series.path}?e2e_probe=1`));
	});

	test('membership UUID path 303s to the slug membership URL with query intact', async ({
		page
	}) => {
		const org = await createOrganization({ publicVisibility: true });
		await page.goto(`/org/${org.id}/membership?e2e_probe=1`);
		await expect(page).toHaveURL(endsWith(`/org/${org.slug}/membership?e2e_probe=1`));
	});

	test('a PRIVATE event resolves for its authenticated buyer (SSR auth via cookies)', async ({
		asOwner
	}) => {
		const event = await createTicketedEvent({ event: { visibility: 'private' } });
		await asOwner.goto(`/events/${UNKNOWN_UUID}/${event.id}?e2e_probe=1`);
		await expect(asOwner).toHaveURL(endsWith(`${event.path}?e2e_probe=1`));
		await expect(asOwner.getByRole('heading', { name: event.name })).toBeVisible();
	});

	test('a PRIVATE event anonymous → redirected home, never an error page', async ({ page }) => {
		const event = await createTicketedEvent({ event: { visibility: 'private' } });
		await page.goto(`/events/${UNKNOWN_UUID}/${event.id}?payment_success=true`);
		await expect(page).toHaveURL('/');
	});

	test('unknown UUIDs → redirected home, never an error page', async ({ page }) => {
		await page.goto(`/events/${UNKNOWN_UUID}/${UNKNOWN_UUID}?payment_success=true`);
		await expect(page).toHaveURL('/');

		await page.goto(`/events/${UNKNOWN_UUID}/series/${UNKNOWN_UUID}?payment_success=true`);
		await expect(page).toHaveURL('/');

		await page.goto(`/org/${UNKNOWN_UUID}/membership?membership_success=true`);
		await expect(page).toHaveURL('/');
	});

	test('membership UUID path resolves a PRIVATE org for its owner', async ({ browser }) => {
		const org = await createOrganization(); // default: private visibility
		const ownerPage = await pageAs(browser, org.owner);
		await ownerPage.goto(`/org/${org.id}/membership?e2e_probe=1`);
		await expect(ownerPage).toHaveURL(endsWith(`/org/${org.slug}/membership?e2e_probe=1`));
		await ownerPage.context().close();
	});
});
