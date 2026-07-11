import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { waitForClientAuth } from '../../support/navigation';
import { createTicketedEvent } from '../../support/factories';

// J4 (USER_JOURNEYS.md) — members-only access is enforced per organization,
// on both of the backend's independent axes:
//
// - `event_type: members-only` (the seeded Beta events): the event is
//   publicly *visible*, but only members get the RSVP affordance — everyone
//   else gets the "Members only" gate with a Join Organization CTA.
// - `visibility: members-only` (arranged; nothing seeded uses it): the event
//   is *hidden* from non-members outright — direct URL → 404.
//
// Frank (betaMember) is a Beta member with a seeded YES RSVP on the workshop;
// all assertions here are read-only so his seeded state stays untouched.

const BETA_WORKSHOP = '/events/tech-innovators-network/ai-apis-workshop';

async function openEvent(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	// The RSVP card / gate renders from the authenticated eligibility query —
	// wait for the client auth bootstrap before asserting on it.
	await waitForClientAuth(page);
}

test.describe('J4 members-only access @p1', () => {
	test('a Beta member gets the RSVP affordance on a Beta members-only event', async ({
		asBetaMember
	}) => {
		await openEvent(asBetaMember, BETA_WORKSHOP);

		// Frank arrives with his seeded YES RSVP, so instead of the "Will you
		// attend?" ask he gets the attending state + a way to change it — and
		// crucially, no membership gate. Read-only: nothing here mutates it.
		await expect(
			asBetaMember.getByRole('status').filter({ hasText: "You're attending" })
		).toBeVisible();
		await expect(asBetaMember.getByRole('button', { name: 'Change RSVP' })).toBeVisible();
		await expect(asBetaMember.getByRole('heading', { name: 'Members only' })).toBeHidden();
		await expect(asBetaMember.getByRole('button', { name: 'Join Organization' })).toBeHidden();
	});

	test('a non-member sees the join gate instead of the RSVP card', async ({ asUser }) => {
		await openEvent(asUser, BETA_WORKSHOP);

		await expect(asUser.getByRole('heading', { name: 'Members only' })).toBeVisible();
		await expect(asUser.getByRole('button', { name: 'Join Organization' })).toBeVisible();
		await expect(asUser.getByRole('button', { name: /^RSVP Yes/ })).toBeHidden();
	});

	test('membership does not cross organizations', async ({ asMember }) => {
		// Charlie is an Org Alpha member — Beta's members-only event still gates him.
		await openEvent(asMember, BETA_WORKSHOP);

		await expect(asMember.getByRole('heading', { name: 'Members only' })).toBeVisible();
		await expect(asMember.getByRole('button', { name: /^RSVP Yes/ })).toBeHidden();
	});

	test('a members-only-visibility event is hidden from non-members entirely', async ({
		asMember,
		asUser
	}) => {
		// Nothing seeded uses visibility=members-only — arrange an Org Alpha
		// event so charlie (member) can see it and hannah (no membership) can't.
		const event = await createTicketedEvent({
			freeTier: false,
			event: {
				event_type: 'members-only',
				visibility: 'members-only',
				requires_ticket: false
			}
		});

		// The member reaches the detail page and is eligible to RSVP.
		await openEvent(asMember, event.path);
		await expect(asMember.getByRole('heading', { name: event.name, level: 1 })).toBeVisible();
		await expect(asMember.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// The non-member gets a 404 — the event does not exist for her.
		const response = await asUser.goto(event.path);
		expect(response?.status()).toBe(404);
	});
});
