import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { waitForClientAuth } from '../../support/navigation';

// J5.2 (USER_JOURNEYS.md) — the implicit eligibility pipeline, exercised
// against the 11 seeded `test-*` events of the Eligibility Test Organization
// (bootstrap_test_events). Each event is built to trip exactly one gate; the
// detail page must surface the matching CTA / explanation to a plain
// authenticated user (hannah — no relationship with the org).
//
// Read-only: nothing is clicked, only the rendered gate is asserted.

interface GateCase {
	slug: string;
	/** Gate headline rendered by EligibilityStatusDisplay / RSVP card. */
	heading?: string;
	/** Primary CTA that must be present (enabled or not). */
	button?: string;
	/** CTAs that must NOT be offered. */
	absentButtons?: string[];
}

const MATRIX: GateCase[] = [
	{ slug: 'test-accessible-event', heading: 'Will you attend?', button: 'RSVP Yes' },
	{
		slug: 'test-event-with-questionnaire',
		heading: 'Questionnaire required',
		button: 'Complete Questionnaire',
		absentButtons: ['RSVP Yes']
	},
	{
		slug: 'test-members-only-event',
		heading: 'Members only',
		button: 'Join Organization',
		absentButtons: ['RSVP Yes']
	},
	{
		slug: 'test-private-event',
		heading: 'Invitation required',
		absentButtons: ['RSVP Yes', 'Get Tickets']
	},
	{
		slug: 'test-full-capacity-event',
		heading: 'Event is full',
		button: 'Join Waitlist',
		absentButtons: ['RSVP Yes']
	},
	{
		slug: 'test-rsvp-deadline-passed',
		heading: 'RSVP deadline passed',
		absentButtons: ['RSVP Yes', 'Join Waitlist']
	},
	{
		slug: 'test-tickets-not-on-sale',
		button: 'Not Available',
		absentButtons: ['Get Tickets', 'Buy Ticket']
	},
	{ slug: 'test-finished-event', heading: 'Event has ended', absentButtons: ['RSVP Yes'] },
	{ slug: 'test-requires-ticket', button: 'Get Tickets', absentButtons: ['RSVP Yes'] }
	// NOTE: the sold-out gate is deliberately NOT here — see the
	// "J5 sold-out gate" describe below for why it arranges its own event.
];

async function openPath(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	// The gate/RSVP card renders from the AUTHENTICATED eligibility query —
	// wait for the client auth bootstrap or the card can miss the assert window.
	await waitForClientAuth(page);
}

async function openEvent(page: Page, slug: string): Promise<void> {
	await openPath(page, `/events/eligibility-test-org/${slug}`);
}

test.describe('J5 eligibility gate matrix @p0', () => {
	for (const gate of MATRIX) {
		test(`${gate.slug} shows its gate`, async ({ asUser }) => {
			await openEvent(asUser, gate.slug);

			if (gate.heading) {
				await expect(asUser.getByRole('heading', { name: gate.heading }).first()).toBeVisible();
			}
			if (gate.button) {
				await expect(
					asUser.getByRole('button', { name: new RegExp(`^${gate.button}`) }).first()
				).toBeVisible();
			}
			for (const absent of gate.absentButtons ?? []) {
				await expect(asUser.getByRole('button', { name: new RegExp(`^${absent}`) })).toBeHidden();
			}
		});
	}

	test('test-draft-event is hidden from non-staff (404)', async ({ asUser }) => {
		const response = await asUser.goto('/events/eligibility-test-org/test-draft-event');
		expect(response?.status()).toBe(404);
	});
});

// The sold-out gate, arranged fresh instead of read off the seeded
// `test-sold-out-event`.
//
// That fixture is capacity 5 / 5 ACTIVE tickets at bootstrap time, but it does
// not survive the canonical reseed: `make seed` runs AFTER `make bootstrap`,
// and the showcase seeder's `_create_payments` sweeps
// `Ticket.objects.filter(tier__payment_method=ONLINE, payment__isnull=True)`
// GLOBALLY — the bootstrap fixture's five payment-less online tickets included.
// Whichever of them the seeder rolls REFUNDED is flipped to CANCELLED and its
// tier's `quantity_sold` decremented, so the event silently stops being sold
// out (observed: 5 → 3, `cancellation_source=stripe_dashboard`). Restoring it
// takes BOTH halves — ticket rows back to ACTIVE *and* the denormalized
// `quantity_sold` counter back to 5.
//
// So this coverage owns its inventory end to end: capacity-1 event, one
// free tier of exactly one ticket, one throwaway buyer who takes it. Nothing
// here is shared with another spec, and no reseed can drift it.
test.describe('J5 sold-out gate @p0', () => {
	test('sold-out tier renders as Sold Out with waitlist fallback', async ({ asUser }) => {
		test.setTimeout(120_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { max_attendees: 1, waitlist_open: true }
		});
		// The auto-created "General Admission" tier would still be purchasable
		// and would keep offering "Get Tickets" next to our sold-out one.
		await deleteDefaultTier(event.id);
		const tier = await createTicketTier(event.id, {
			name: 'Last Ticket',
			payment_method: 'free',
			price: '0.00',
			total_quantity: 1
		});
		const buyer = await createVerifiedUser('SoldOut');
		await claimTicketViaApi(buyer, event.id, tier.id);

		await openPath(asUser, event.path);

		// Event-level gate: capacity is gone, so the waitlist replaces the
		// purchase CTA.
		await expect(asUser.getByRole('button', { name: /^Join Waitlist/ }).first()).toBeVisible();
		await expect(asUser.getByRole('button', { name: /^Get Tickets/ })).toBeHidden();

		// Tier-level: the card itself states Sold Out on a disabled button and
		// the tier list stays on the page rather than disappearing.
		await expect(asUser.getByRole('button', { name: 'Sold Out', exact: true })).toBeDisabled();
		await expect(asUser.getByRole('heading', { name: 'Ticket Options' })).toBeVisible();
	});
});
