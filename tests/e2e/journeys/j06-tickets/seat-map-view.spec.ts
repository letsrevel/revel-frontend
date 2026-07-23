import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeededConcertHall,
	releaseHoldsViaApi,
	type ThrowawayUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 / #659 — the buyer seat-picker Map/List view toggle. The SVG map and the
// row-list are alternative renderings of the SAME hold state; toggling between
// them must preserve the selection.
//
// Smoke only (deep geometry/heuristic behaviour is covered by the unit tests
// seat-view-toggle.test.ts / SeatMap.test.ts / seat-map-layout.test.ts): open
// the confirmation dialog, drive the 'Seat display' toggle to Map, assert the
// SVG map ("Seat map" group) renders, tap a seat ON THE MAP (a real hold
// round-trip), assert it reads pressed with the held notice, then toggle to
// List and assert the same seat shows selected there — state shared through
// the seat-hold controller.
//
// Note: the seeded "Revel Concert Hall" has 100 active seats in a single
// sector, so the complexity heuristic (>60 seats) actually defaults this chart
// to MAP, not List — the spec drives the toggle explicitly rather than leaning
// on the default. Isolation: own offline user_choice event on Org Alpha
// attached to the hall; row A is accessible, so B2 (bare accessible name) is
// used. Hold-aware retries: a second tap on a pressed seat RELEASES it, so the
// loop only clicks when the seat isn't already pressed.

test.describe('J6 seat map view @p2', () => {
	const holdCleanups: Array<{ user: ThrowawayUser; eventId: string }> = [];

	test.afterEach(async () => {
		for (const { user, eventId } of holdCleanups.splice(0)) {
			await releaseHoldsViaApi(user, eventId).catch(() => undefined);
		}
	});

	test('toggle to the SVG map, tap a seat, and the list shares the selection', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, buyer] = await Promise.all([
			// The chart/availability endpoints resolve the venue from event.venue_id.
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('MapBuyer')
		]);
		await deleteDefaultTier(event.id); // its auto-tier card also says "Reserve Ticket"
		await createTicketTier(event.id, {
			name: 'Choose Your Seat',
			payment_method: 'offline',
			price: '25.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});

		const context = await browser.newContext();
		try {
			await authenticateContext(context, buyer);
			const page = await context.newPage();
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			// Open the confirmation dialog (idempotent loop, see seat-selection.spec.ts).
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				}
				await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// The Map/List segmented control appears once the seats have loaded.
			const displayToggle = confirmDialog.getByRole('group', { name: 'Seat display' });
			await expect(displayToggle).toBeVisible({ timeout: 15_000 });

			// Switch to the MAP view and assert the SVG surface renders.
			await displayToggle.getByRole('button', { name: 'Map' }).click();
			const seatMap = confirmDialog.getByRole('group', { name: 'Seat map' });
			await expect(seatMap).toBeVisible({ timeout: 15_000 });

			// Tap B2 ON THE MAP — each tap is a hold round-trip (briefly "…, updating"
			// while the POST is in flight, so the exact-name locator only resolves
			// once it settles). A second click would release, hence the guarded loop.
			const mapSeat = seatMap.getByRole('button', { name: /^Seat B2(,|$)/ });
			await expect(async () => {
				if ((await mapSeat.getAttribute('aria-pressed')) !== 'true') {
					await mapSeat.click();
				}
				await expect(mapSeat).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			}).toPass({ timeout: 30_000 });
			holdCleanups.push({ user: buyer, eventId: event.id });
			await expect(
				confirmDialog.getByText('Selected seats are held for you for 10 minutes.')
			).toBeVisible();

			// Toggle back to the LIST — the same seat is still selected (shared state).
			await displayToggle.getByRole('button', { name: 'List' }).click();
			await expect(seatMap).toBeHidden();
			const listSeat = confirmDialog.getByRole('button', { name: /^Seat B2(,|$)/ });
			await expect(listSeat).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
		} finally {
			await context.close();
		}
	});

	// Pan & zoom smoke (#659 + the mouse-pan-at-any-zoom fix): the map's inner
	// <g> carries the whole viewport as `translate(tx ty) scale(s)`, so the
	// transform attribute IS the observable state. Zoom buttons are the
	// accessible path (a bare wheel deliberately scrolls the dialog instead);
	// a mouse drag pans at any scale and must suppress the release-click so
	// panning over a seat never holds it. Reset restores the exact initial
	// transform.
	test('zoom buttons rescale the map, mouse drag pans without selecting, reset restores', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const hall = await getSeededConcertHall();
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { venue_id: hall.venueId } }),
			createVerifiedUser('ZoomBuyer')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Choose Your Seat',
			payment_method: 'offline',
			price: '25.00',
			seat_assignment_mode: 'user_choice',
			venue_id: hall.venueId,
			sector_id: hall.sectorId
		});

		const context = await browser.newContext();
		try {
			await authenticateContext(context, buyer);
			const page = await context.newPage();
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				}
				await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			const displayToggle = confirmDialog.getByRole('group', { name: 'Seat display' });
			await expect(displayToggle).toBeVisible({ timeout: 15_000 });
			await displayToggle.getByRole('button', { name: 'Map' }).click();
			const seatMap = confirmDialog.getByRole('group', { name: 'Seat map' });
			await expect(seatMap).toBeVisible({ timeout: 15_000 });

			// The viewport <g> is the svg's only direct group child.
			const surface = seatMap.locator('> g');
			const initial = await surface.getAttribute('transform');
			expect(initial).toBe('translate(0 0) scale(1)');

			// Fit-all regression guard: the svg must FILL its fixed-height frame
			// (h-full chain) so `meet` letterboxes the whole chart into view —
			// without it the svg takes its intrinsic aspect-ratio height and the
			// frame's overflow-hidden clips the bottom of the venue.
			const fit = await seatMap.evaluate((svg) => {
				const frame = svg.closest('div.overflow-hidden');
				if (!frame) return null;
				const svgRect = svg.getBoundingClientRect();
				const frameRect = frame.getBoundingClientRect();
				return { svgH: svgRect.height, frameH: frameRect.height };
			});
			if (!fit) throw new Error('Seat map frame not found');
			expect(Math.abs(fit.svgH - fit.frameH)).toBeLessThan(4);

			// Mouse-drag pan (works at any scale): drag FROM the B2 seat element —
			// dragging from the svg's box center can land on the dialog overlay
			// (the map is inside a scrollable dialog, so the geometric center may
			// be clipped out of view) and a pointerdown there dismisses the
			// dialog. The seat itself is scrolled into view and visible. The
			// release-click must be suppressed: the drag must not hold the seat
			// under the pointer.
			const dragSeat = seatMap.getByRole('button', { name: /^Seat B2(,|$)/ });
			await dragSeat.hover();
			const seatBox = await dragSeat.boundingBox();
			if (!seatBox) throw new Error('Seat B2 has no bounding box');
			const startX = seatBox.x + seatBox.width / 2;
			const startY = seatBox.y + seatBox.height / 2;
			await page.mouse.move(startX, startY);
			await page.mouse.down();
			await page.mouse.move(startX + 40, startY + 25, { steps: 8 });
			await page.mouse.up();
			await expect(surface).not.toHaveAttribute('transform', initial);
			await expect(confirmDialog).toBeVisible();
			await expect(seatMap.locator('[aria-pressed="true"]')).toHaveCount(0);

			// Zoom in ×2 clicks: scale 1 → 1.25 → 1.5625 (exact float products;
			// the pan offset above only changes the translate part).
			await confirmDialog.getByRole('button', { name: 'Zoom in' }).click();
			await expect(surface).toHaveAttribute('transform', /scale\(1\.25\)/);
			await confirmDialog.getByRole('button', { name: 'Zoom in' }).click();
			await expect(surface).toHaveAttribute('transform', /scale\(1\.5625\)/);

			// Zoom out steps back down (1.5625 × 0.8 = 1.25), reset restores the
			// exact initial transform.
			await confirmDialog.getByRole('button', { name: 'Zoom out' }).click();
			await expect(surface).toHaveAttribute('transform', /scale\(1\.25\)/);
			await confirmDialog.getByRole('button', { name: 'Reset zoom' }).click();
			await expect(surface).toHaveAttribute('transform', 'translate(0 0) scale(1)');
		} finally {
			await context.close();
		}
	});
});
