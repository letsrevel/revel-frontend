import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	uniqueName
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #680 — multi-floor venues, buyer side. A chart whose venue metadata
// declares floors (`metadata.floors`) renders the whole-venue surfaces ONE
// floor at a time behind segmented floor chips: the overview dialog defaults
// to the first floor, the purchase dialog's "Whole venue" scope defaults to
// the floor the TIER's sector lives on, and switching floors is pure
// presentation — held seats survive. The venue-level STAGE pill renders on
// the FIRST floor only (the stage has no floor field; ground floor is the
// convention). Sectors without a `metadata.floor` belong to the first floor.
//
// Isolation: own venue + event (floors written via the admin API); the taps
// place REAL server holds, so nothing seeded is touched.

interface FlooredEvent {
	eventPath: string;
}

/** Two-floor venue: Ground Stalls (implicit first floor) + Upper Balcony. */
async function arrangeFlooredEvent(): Promise<FlooredEvent> {
	const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
	const venue = await owner.post<{ id: string }>(
		'/api/organization-admin/revel-events-collective/venues',
		{ name: uniqueName('Floors Venue') }
	);
	const stalls = await owner.post<{ id: string }>(
		`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
		{
			name: 'Ground Stalls',
			kind: 'seated',
			// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
			seats: [
				{ label: 'A1', row: 'A', number: 1 },
				{ label: 'A2', row: 'A', number: 2 },
				{ label: 'A3', row: 'A', number: 3 }
			]
		}
	);
	const balcony = await owner.post<{ id: string }>(
		`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
		{
			name: 'Upper Balcony',
			kind: 'seated',
			seats: [
				{ label: 'B1', row: 'B', number: 1 },
				{ label: 'B2', row: 'B', number: 2 }
			]
		}
	);
	// The floors convention, exactly as the designer writes it: venue-level
	// floor list + per-sector floor id. Ground Stalls stays UNASSIGNED to
	// prove the implicit-first-floor rule end to end.
	await owner.put(`/api/organization-admin/revel-events-collective/venues/${venue.id}`, {
		metadata: {
			floors: [
				{ id: 'ground', name: 'Ground floor', order: 0 },
				{ id: 'upper', name: 'Upper floor', order: 1 }
			]
		}
	});
	await owner.put(
		`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors/${balcony.id}`,
		{ metadata: { floor: 'upper' } }
	);

	const event = await createTicketedEvent({ freeTier: false, event: { venue_id: venue.id } });
	await deleteDefaultTier(event.id);
	await createTicketTier(event.id, {
		name: 'Stalls Ticket',
		payment_method: 'offline',
		price: '20.00',
		seat_assignment_mode: 'user_choice',
		venue_id: venue.id,
		sector_id: stalls.id,
		max_tickets_per_user: 4
	});
	await createTicketTier(event.id, {
		name: 'Balcony Ticket',
		payment_method: 'offline',
		price: '30.00',
		seat_assignment_mode: 'user_choice',
		venue_id: venue.id,
		sector_id: balcony.id,
		max_tickets_per_user: 4
	});
	return { eventPath: event.path };
}

test.describe('J6 venue floors @p2', () => {
	test('overview shows floor chips: one floor at a time, stage on the first floor only', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [{ eventPath }, buyer] = await Promise.all([
			arrangeFlooredEvent(),
			createVerifiedUser('FloorsOverview')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, eventPath);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Floor chips render, first floor active by default; only the ground
			// sectors (implicit first floor) are on this view, with the STAGE pill.
			const chips = overview.getByRole('group', { name: 'Floors' });
			const groundChip = chips.getByRole('button', { name: 'Ground floor', exact: true });
			const upperChip = chips.getByRole('button', { name: 'Upper floor', exact: true });
			await expect(groundChip).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
			await expect(overview.getByRole('button', { name: /^Seat A1(,|$)/ })).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Seat B1(,|$)/ })).toBeHidden();
			await expect(overview.getByText('STAGE')).toBeVisible();

			// The upper floor renders ONLY its sector — and no stage pill (the
			// stage belongs to the ground floor by convention).
			await upperChip.click();
			await expect(upperChip).toHaveAttribute('aria-pressed', 'true');
			await expect(overview.getByRole('button', { name: /^Seat B1(,|$)/ })).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Seat A1(,|$)/ })).toBeHidden();
			await expect(overview.getByText('STAGE')).toBeHidden();

			// And back.
			await groundChip.click();
			await expect(overview.getByRole('button', { name: /^Seat A1(,|$)/ })).toBeVisible();
			await expect(overview.getByText('STAGE')).toBeVisible();
		} finally {
			await context.close();
		}
	});

	// #853 rewrite (wave 2, task 11): the legacy `TicketTierModal` ("Select
	// Your Ticket") + `TicketConfirmationDialog` ("Reserve Ticket") this test
	// opened are BOTH deleted — structurally impossible to keep as a pure
	// locator-sanity read, so (per this task's brief) only this purchase leg
	// is rewritten; the sibling overview test above is untouched. "Reserve
	// Ticket" is now a tier-card button that opens `SeatPickerDialog`
	// directly (testid `seat-picker-dialog`), hosting the SAME
	// `SeatPickerPanel` whole-venue-scope + floor-chip UI verbatim (wave-1
	// convention). One behavior did narrow in the move: `SeatPickerDialog`
	// never wires `allTiers`/`onSwitchTier` into the panel (confirmed by
	// reading the source — only the unauthenticated guest dialog still does),
	// so the OTHER sold sector on the ground floor is no longer a clickable
	// switch target — it renders as an inert ghost, same as any other
	// out-of-scope sector (see seat-selection.spec.ts's whole-venue test).
	// The floor-default + pure-presentation-switching properties this test is
	// actually about are unaffected by that change.
	test("purchase dialog defaults to the tier's floor; held seat survives floor switching", async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [{ eventPath }, buyer] = await Promise.all([
			arrangeFlooredEvent(),
			createVerifiedUser('FloorsHold')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, eventPath);
			await waitForClientAuth(page);

			// Open the seat picker for Balcony Ticket (its sector is on the UPPER
			// floor) via the tier card's "Pick seats…" button.
			const balconyCard = page
				.locator('div.bg-card')
				.filter({ has: page.getByRole('heading', { name: 'Balcony Ticket', exact: true }) });
			const picker = page.getByTestId('seat-picker-dialog');
			await expect(async () => {
				if (await picker.isVisible()) return;
				await balconyCard.getByRole('button', { name: 'Pick seats…', exact: true }).click();
				await expect(picker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Hold B1 in the default "This section" scope (a real server hold).
			const seatB1 = picker.getByRole('button', { name: /^Seat B1(,|$)/ });
			await expect(async () => {
				if ((await seatB1.getAttribute('aria-pressed')) !== 'true') {
					await seatB1.click();
				}
				await expect(seatB1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			}).toPass({ timeout: 60_000 });
			// Denominator is the tier's max_tickets_per_user cap (4), not the held
			// count — #853 final-review fix (self-referential chip).
			await expect(picker.getByText('1 / 4 selected')).toBeVisible();

			// Whole venue: floor chips appear and DEFAULT to the tier's floor
			// (Upper), not the first one.
			await picker.getByRole('button', { name: 'Whole venue' }).click();
			const chips = picker.getByRole('group', { name: 'Floors' });
			const groundChip = chips.getByRole('button', { name: 'Ground floor', exact: true });
			const upperChip = chips.getByRole('button', { name: 'Upper floor', exact: true });
			await expect(upperChip).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
			await expect(seatB1).toHaveAttribute('aria-pressed', 'true');

			// The ground floor's view shows the OTHER sold sector as an inert
			// ghost (not a switch target — see the note above) on its own floor
			// — and no held seats.
			await groundChip.click();
			await expect(
				picker.getByRole('img', { name: 'Ground Stalls: sold through a different ticket' })
			).toBeVisible({ timeout: 15_000 });
			await expect(seatB1).toBeHidden();

			// Switching floors is pure presentation: back on Upper, B1 is STILL
			// held and the count untouched.
			await upperChip.click();
			await expect(seatB1).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
			// Denominator is the tier's max_tickets_per_user cap (4), not the held
			// count — #853 final-review fix (self-referential chip).
			await expect(picker.getByText('1 / 4 selected')).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
