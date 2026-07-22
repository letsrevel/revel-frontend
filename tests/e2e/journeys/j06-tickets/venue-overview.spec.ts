import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier,
	getSeededBestAvailableEvent,
	uniqueName
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// #679 — map-first tier selection: the public event page grows a "View
// seating map" entry point that opens a whole-venue overview where every
// sector shows which tier(s) sell it at what price. A 1:1 best-available
// sector (Galleria) routes STRAIGHT into that tier's purchase dialog; a 1:N
// sector (Platea — sold by a flat user_choice tier AND a category-priced
// best-available tier) opens a small chooser first. A sector sold by EXACTLY
// ONE user_choice tier (Palco 1) renders its seats DIRECTLY selectable in
// the overview (seating phase 2): taps are real server holds, and Continue
// hands them to the purchase dialog. Sectors sold by no purchasable tier
// (Palco 2–4) render as inert not-for-sale ghosts.
//
// Isolation: the first and third tests run read-only against the SHARED
// seeded "La Traviata — Season Opening" showcase event (see
// best-available.spec.ts) — dialogs are opened and closed but nothing is
// ever held or reserved, so parallel specs are unaffected. The seat-holding
// test arranges its OWN throwaway venue + event instead. The seeded venue
// has NO stage metadata, so the overview shows the fallback top-center
// STAGE pill (expected, not a bug).

test.describe('J6 map-first venue overview @p2', () => {
	test('seating map entry → sector overview → 1:1 direct route → 1:N chooser', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('MapFirst')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			// Sector targets carry the selling tier(s) + price(s) in their names.
			const galleriaSector = overview.getByRole('button', {
				name: 'Galleria: Galleria, EUR 25.00'
			});
			const plateaSector = overview.getByRole('button', {
				name: 'Platea: Platea, EUR 45.00; Platea — Best Available, EUR 45.00 - EUR 80.00'
			});

			// Open the overview from the Ticket Options entry point.
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Every sector renders: target sectors as focusable buttons, the
			// single-user_choice Palco 1 as DIRECTLY selectable seats (no
			// whole-sector target), the unsold Palchi as inert ghosts, plus the
			// fallback STAGE pill.
			await expect(galleriaSector).toBeVisible({ timeout: 15_000 });
			await expect(plateaSector).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 1:/ })).toBeHidden();
			await expect(overview.getByRole('button', { name: /^Seat 1-1/ })).toBeVisible();
			await expect(
				overview.getByRole('img', { name: 'Palco 2: no tickets on sale' })
			).toBeVisible();
			await expect(overview.getByRole('button', { name: /^Palco 2/ })).toBeHidden();
			await expect(overview.getByText('STAGE')).toBeVisible();

			// Galleria is sold by ONE tier → routes straight into its purchase
			// dialog (best-available panel; the single Galleria zone
			// auto-selects once availability loads).
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			const bestPanel = confirmDialog.getByText('Best available seats');
			await expect(async () => {
				if (await bestPanel.isVisible()) return;
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await galleriaSector.click();
				await expect(bestPanel).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(confirmDialog.getByRole('radio', { name: /Galleria/ })).toBeChecked({
				timeout: 8_000
			});

			// Back out. Escape only closes the TOPMOST dialog: the confirmation
			// first, then the pre-selected "Select Your Ticket" modal that sits
			// beneath it (same stacking as the inline TierCard pre-selection).
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) await page.keyboard.press('Escape');
				await expect(confirmDialog).toBeHidden();
				if (await tierDialog.isVisible()) await page.keyboard.press('Escape');
				await expect(tierDialog).toBeHidden();
			}).toPass({ timeout: 30_000 });

			// Platea is sold by TWO tiers → the chooser lists BOTH with their
			// honest prices and a seat-assignment mode hint.
			const chooser = page.getByRole('dialog', { name: 'Choose a ticket for Platea' });
			await expect(async () => {
				if (await chooser.isVisible()) return;
				if (!(await overview.isVisible())) {
					await openMap.click();
					await expect(overview).toBeVisible({ timeout: 8_000 });
				}
				await plateaSector.click();
				await expect(chooser).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			const flatOption = chooser.getByRole('button', { name: /^Platea EUR 45\.00/ });
			const bestOption = chooser.getByRole('button', {
				name: /^Platea — Best Available EUR 45\.00 - EUR 80\.00/
			});
			await expect(flatOption).toBeVisible();
			await expect(flatOption).toContainText('Choose your own seats');
			await expect(bestOption).toBeVisible();
			await expect(bestOption).toContainText('Best available seats assigned');

			// Picking the best-available tier lands in ITS dialog: the mandatory
			// two-zone picker renders both zones and their prices (nothing
			// auto-selects with two zones).
			const zonePicker = confirmDialog.getByText('Seating zone', { exact: true });
			await expect(async () => {
				if (await zonePicker.isVisible()) return;
				if (await bestOption.isVisible()) {
					await bestOption.click();
				}
				await expect(zonePicker).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			await expect(confirmDialog.getByRole('radio', { name: /Platea Premium/ })).toBeVisible();
			await expect(confirmDialog.getByText('€80.00')).toBeVisible();
			await expect(confirmDialog.getByText('€45.00')).toBeVisible();
		} finally {
			await context.close();
		}
	});

	// Seat-level selection in the overview (seating phase 2): a sector sold by
	// exactly one user_choice tier renders live seats; two taps grow the
	// selection WITHOUT any stepper, the footer shows count + estimated total,
	// and Continue hands the SAME server holds to the purchase dialog, which
	// adopts them (counter auto-grown to 2) and reserves them onto tickets.
	//
	// Isolation: own venue + event — the taps place REAL server holds, so the
	// shared seeded showcase must not be touched.
	test('overview seat taps → footer count/total → Continue adopts holds → reserve succeeds', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const owner = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const venue = await owner.post<{ id: string }>(
			'/api/organization-admin/revel-events-collective/venues',
			{ name: uniqueName('Overview Venue') }
		);
		const pickable = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Picker Stalls',
				kind: 'seated',
				// Seat writes still use `row` (becomes `row_label` in the Phase-2 rename).
				seats: [
					{ label: 'A1', row: 'A', number: 1 },
					{ label: 'A2', row: 'A', number: 2 },
					{ label: 'A3', row: 'A', number: 3 }
				]
			}
		);
		const assigned = await owner.post<{ id: string }>(
			`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
			{
				name: 'Assigned Balcony',
				kind: 'seated',
				seats: [
					{ label: 'B1', row: 'B', number: 1 },
					{ label: 'B2', row: 'B', number: 2 }
				]
			}
		);
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false, event: { venue_id: venue.id } }),
			createVerifiedUser('OverviewSeats')
		]);
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Pick Seats',
			payment_method: 'offline',
			price: '20.00',
			seat_assignment_mode: 'user_choice',
			venue_id: venue.id,
			sector_id: pickable.id,
			max_tickets_per_user: 4
		});
		await createTicketTier(event.id, {
			name: 'Rear Best',
			payment_method: 'offline',
			price: '30.00',
			seat_assignment_mode: 'best_available',
			venue_id: venue.id,
			sector_id: assigned.id
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const overview = page.getByRole('dialog', { name: 'Seating map' });
			const openMap = page.getByRole('button', { name: 'View seating map', exact: true });
			await expect(async () => {
				if (await overview.isVisible()) return;
				await openMap.click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// The best-available sector stays a whole-sector target; the
			// user_choice sector renders its live seats instead of a target.
			await expect(
				overview.getByRole('button', { name: 'Assigned Balcony: Rear Best, EUR 30.00' })
			).toBeVisible({ timeout: 15_000 });
			await expect(overview.getByRole('button', { name: /^Picker Stalls:/ })).toBeHidden();

			// Tap A1 then A2 — real holds, no stepper anywhere: the footer count
			// and the estimated total (flat 20.00 × seats) grow tap by tap. Only
			// click while unpressed (a second tap would RELEASE the hold).
			const seatA1 = overview.getByRole('button', { name: /^Seat A1(,|$)/ });
			const seatA2 = overview.getByRole('button', { name: /^Seat A2(,|$)/ });
			await expect(async () => {
				if ((await seatA1.getAttribute('aria-pressed')) !== 'true') {
					await seatA1.click();
				}
				await expect(seatA1).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(overview.getByText('1 seat selected')).toBeVisible({ timeout: 5_000 });
				await expect(overview.getByText('€20.00')).toBeVisible();
			}).toPass({ timeout: 60_000 });
			await expect(async () => {
				if ((await seatA2.getAttribute('aria-pressed')) !== 'true') {
					await seatA2.click();
				}
				await expect(seatA2).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
				await expect(overview.getByText('2 seats selected')).toBeVisible({ timeout: 5_000 });
				await expect(overview.getByText('€40.00')).toBeVisible();
			}).toPass({ timeout: 60_000 });

			// Continue hands the holds to the purchase dialog: BOTH seats arrive
			// already selected (adopted via seedFromAvailability) and the counter
			// was auto-grown to 2 — the holds were NOT released by the close.
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				await overview.getByRole('button', { name: 'Continue', exact: true }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 30_000 });
			await expect(confirmDialog.getByRole('button', { name: /^Seat A1(,|$)/ })).toHaveAttribute(
				'aria-pressed',
				'true',
				{ timeout: 15_000 }
			);
			await expect(confirmDialog.getByRole('button', { name: /^Seat A2(,|$)/ })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(confirmDialog.getByText('2 / 2 selected')).toBeVisible();

			// Reserve to success — the adopted holds become the tickets' seats.
			await confirmDialog.getByPlaceholder('Your name').fill('Seat Buyer');
			await confirmDialog.getByPlaceholder('Guest 2 name').fill('Plus One');
			const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
			await expect(async () => {
				if (await success.isVisible()) return;
				await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(success).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			// Two tickets (carousel), each carrying one of the tapped Row A seats.
			await expect(success.getByText('Ticket 1 of 2')).toBeVisible();
			await expect(success.getByText(/Row A, Seat [12]/)).toBeVisible();
			await success.getByRole('button', { name: 'Next ticket' }).click();
			await expect(success.getByText('Ticket 2 of 2')).toBeVisible();
			await expect(success.getByText(/Row A, Seat [12]/)).toBeVisible();
		} finally {
			await context.close();
		}
	});

	// Tier-modal map entry + remembered preference: the tier modal grows a
	// "View seating map" button; using it once makes SUBSEQUENT modal opens
	// this session auto-open the overview (once per open — closing the
	// overview reveals the tier list again). Read-only on the seeded event.
	test('tier modal map button opens the overview; pref auto-opens it next time', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('MapPref')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const overview = page.getByRole('dialog', { name: 'Seating map' });

			// Open the tier modal and use ITS map button (scoped: the page's
			// tier list renders a same-named button underneath).
			await expect(async () => {
				if (await overview.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
					await expect(tierDialog).toBeVisible({ timeout: 8_000 });
				}
				await tierDialog.getByRole('button', { name: 'View seating map', exact: true }).click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Closing the overview reveals the tier list (it must stay reachable).
			await expect(async () => {
				if (await overview.isVisible()) await page.keyboard.press('Escape');
				await expect(overview).toBeHidden();
			}).toPass({ timeout: 30_000 });
			await expect(tierDialog).toBeVisible();

			// Close the tier modal too, then reopen it: the remembered pref
			// auto-opens the overview WITHOUT touching the map button.
			await expect(async () => {
				if (await tierDialog.isVisible()) await page.keyboard.press('Escape');
				await expect(tierDialog).toBeHidden();
			}).toPass({ timeout: 30_000 });
			await expect(async () => {
				if (await overview.isVisible()) return;
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				await expect(overview).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });
			// The tier list is still there beneath — closing the overview once
			// more must NOT re-trigger the auto-open (fires once per modal open).
			await expect(async () => {
				if (await overview.isVisible()) await page.keyboard.press('Escape');
				await expect(overview).toBeHidden();
			}).toPass({ timeout: 30_000 });
			await expect(tierDialog).toBeVisible();
			await expect(overview).toBeHidden();
		} finally {
			await context.close();
		}
	});
	// Section switching from INSIDE a purchase dialog: with the whole-venue map
	// open, other sold sectors are labelled click targets — clicking one
	// PROMPTS (never silently swaps), warns about held seats, and picking a
	// tier swaps the dialog to that section's tier (the remount releases the
	// old holds).
	test('whole-venue map in the purchase dialog: clicking another section prompts a tier switch', async ({
		browser
	}) => {
		test.setTimeout(120_000);

		const [seeded, buyer] = await Promise.all([
			getSeededBestAvailableEvent(),
			createVerifiedUser('SectorSwitch')
		]);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, seeded.eventPath);
			await waitForClientAuth(page);

			// Open the Palco 1 (user_choice) purchase dialog via the tier list.
			const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
			const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
			await expect(async () => {
				if (await confirmDialog.isVisible()) return;
				if (!(await tierDialog.isVisible())) {
					await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				}
				const palcoCard = tierDialog
					.locator('.bg-card')
					.filter({ has: page.getByRole('heading', { name: 'Palco 1', exact: true }) });
				await palcoCard.getByRole('button', { name: 'Reserve Ticket' }).click();
				await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 60_000 });

			// Hold one seat, then widen to the whole venue.
			const seat = confirmDialog.getByRole('button', { name: /^Seat 1-2(,|$)/ });
			await expect(async () => {
				if ((await seat.getAttribute('aria-pressed')) !== 'true') {
					await seat.click();
				}
				await expect(seat).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
			}).toPass({ timeout: 60_000 });
			await confirmDialog.getByRole('button', { name: 'Whole venue' }).click();

			// Other sold sectors are labelled targets now; Galleria carries its
			// tier + price. Clicking prompts — with the held-seat warning.
			const galleriaTarget = confirmDialog.getByRole('button', { name: /^Galleria: Galleria/ });
			await expect(galleriaTarget).toBeVisible({ timeout: 15_000 });
			await galleriaTarget.click();
			const prompt = page.getByRole('dialog', { name: 'Switch to Galleria?' });
			await expect(prompt).toBeVisible();
			await expect(prompt.getByText(/1 selected seat/)).toBeVisible();

			// Cancel keeps the current dialog and selection.
			await prompt.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(prompt).toBeHidden();
			await expect(confirmDialog.getByText('Palco 1', { exact: true }).first()).toBeVisible();

			// Confirm the switch: the dialog swaps to the Galleria tier (mapped
			// best-available → the zone picker renders).
			await galleriaTarget.click();
			await expect(prompt).toBeVisible();
			await prompt.getByRole('button', { name: /Galleria/ }).click();
			await expect(prompt).toBeHidden();
			await expect(
				confirmDialog.getByRole('heading', { name: 'Galleria', exact: true })
			).toBeVisible({ timeout: 15_000 });
			await expect(confirmDialog.getByText('Seating zone', { exact: true })).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
