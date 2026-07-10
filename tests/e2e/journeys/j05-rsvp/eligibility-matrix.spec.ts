import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
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
	{ slug: 'test-requires-ticket', button: 'Get Tickets', absentButtons: ['RSVP Yes'] },
	{
		slug: 'test-sold-out-event',
		button: 'Join Waitlist',
		absentButtons: ['Get Tickets']
	}
];

async function openEvent(page: Page, slug: string): Promise<void> {
	await page.goto(`/events/eligibility-test-org/${slug}`);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	// The gate/RSVP card renders from the AUTHENTICATED eligibility query —
	// wait for the client auth bootstrap or the card can miss the assert window.
	await waitForClientAuth(page);
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

	test('sold-out tier renders as Sold Out with waitlist fallback', async ({ asUser }) => {
		await openEvent(asUser, 'test-sold-out-event');
		await expect(asUser.getByRole('button', { name: 'Sold Out', exact: true })).toBeDisabled();
		await expect(asUser.getByRole('heading', { name: 'Ticket Options' })).toBeVisible();
	});
});
