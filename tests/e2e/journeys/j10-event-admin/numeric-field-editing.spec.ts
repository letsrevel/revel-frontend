import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createTicketTier } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import type { Page } from '@playwright/test';

// J10 event editor — numeric fields must survive REAL keystrokes. jsdom unit
// tests can't show these bugs: they live in the caret and in what the browser
// does with a `type="number"` input between keystrokes.
//
// - #922/#923: "Max Tickets Per User" clamped on every input event, so
//   backspacing the last digit refilled "1" under the caret and the value could
//   only be appended to. Empty is now a legal mid-edit state; blur settles it.
// - #935/#936: clearing a DurationInput amount round-tripped through the
//   parent (RefundPolicyEditor maps empty → 0) and the re-sync effect re-picked
//   the unit, flipping a "3 Days" bracket to Hours — the 7 typed next saved as
//   7 hours. Mid-edit the unit the user sees is now held. The cancellation
//   deadline (an `emptyValue={null}` site) had the sibling bug: clearing reset
//   the picked unit to the default.
//
// Same pattern as the #926 assertion in j18-series/recurring-admin.spec.ts.
// Isolation: each test API-arranges its own event.

const SELECT_ALL = 'ControlOrMeta+A';

async function openTicketingTab(page: Page, orgSlug: string, eventId: string): Promise<void> {
	await gotoHydrated(page, `/org/${orgSlug}/admin/events/${eventId}/edit?tab=ticketing`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: 'Ticket Tiers' })).toBeVisible({
		timeout: 15_000
	});
}

test.describe('J10 numeric field editing @p2', () => {
	test('max tickets per user can be cleared and retyped; blur clamps, save persists', async ({
		asOwner
	}) => {
		const event = await createTicketedEvent({ event: { max_tickets_per_user: 3 } });
		const page = asOwner;
		await openTicketingTab(page, event.orgSlug, event.id);

		const field = page.getByLabel('Max Tickets Per User', { exact: true });
		await expect(field).toHaveValue('3');

		// Backspace the only digit: the field stays empty (was refilled with "1").
		await field.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Backspace');
		await expect(field).toHaveValue('');
		await field.pressSequentially('12');
		await expect(field).toHaveValue('12');

		// Select-all + type replaces; a leading zero and a transient "0" are not
		// rewritten mid-typing — blur normalizes "05" to 5.
		await field.press(SELECT_ALL);
		await field.pressSequentially('05');
		await expect(field).toHaveValue('05');
		await field.blur();
		await expect(field).toHaveValue('5');

		// Emptied and abandoned: blur falls back to the minimum of 1.
		await field.click();
		await field.press(SELECT_ALL);
		await page.keyboard.press('Backspace');
		await expect(field).toHaveValue('');
		await field.blur();
		await expect(field).toHaveValue('1');

		// Final edit through the same path, then save and reload.
		await field.click();
		await field.press(SELECT_ALL);
		await page.keyboard.press('Backspace');
		await field.pressSequentially('7');
		await field.blur();
		await expect(field).toHaveValue('7');

		await page.getByRole('button', { name: 'Save', exact: true }).first().click();
		await expect(page.getByText('Event updated successfully!')).toBeVisible({ timeout: 20_000 });

		await openTicketingTab(page, event.orgSlug, event.id);
		await expect(page.getByLabel('Max Tickets Per User', { exact: true })).toHaveValue('7', {
			timeout: 15_000
		});
	});

	test('refund bracket and deadline keep the visible unit while the amount is retyped', async ({
		asOwner
	}) => {
		test.setTimeout(90_000);
		const event = await createTicketedEvent({ freeTier: false });
		const tier = await createTicketTier(event.id, {
			name: 'Refundable Entry',
			payment_method: 'offline',
			price: '20.00',
			price_type: 'fixed',
			total_quantity: 50,
			allow_user_cancellation: false
		});
		const page = asOwner;
		await openTicketingTab(page, event.orgSlug, event.id);

		const tierForm = page.getByRole('dialog', { name: /Edit Ticket Tier/ });
		await page.getByRole('button', { name: `Edit ${tier.name}` }).click();
		await expect(tierForm).toBeVisible();
		await tierForm.getByLabel('Allow attendees to cancel their tickets').check();

		// --- Refund bracket (no empty sentinel: RefundPolicyEditor maps empty → 0).
		await tierForm.getByRole('button', { name: 'Add another bracket' }).click();
		const bracketAmount = tierForm.getByLabel('Time before event', { exact: true });
		const bracketUnit = tierForm.getByRole('button', { name: 'Time before event unit' });
		const summary = tierForm.getByRole('listitem').filter({ hasText: /^≥ \d+h before/ });
		// A fresh bracket is 72h, rendered as 3 Days.
		await expect(bracketAmount).toHaveValue('3');
		await expect(bracketUnit).toHaveText('Days');

		await bracketAmount.click();
		await bracketAmount.press(SELECT_ALL);
		await page.keyboard.press('Backspace');
		await expect(bracketAmount).toHaveValue('');
		// The bug: the picker flipped to Hours here.
		await expect(bracketUnit).toHaveText('Days');
		await bracketAmount.pressSequentially('7');
		await expect(bracketAmount).toHaveValue('7');
		await expect(bracketUnit).toHaveText('Days');
		await expect(summary).toHaveText('≥ 168h before → 100% refund');

		// Emptied and abandoned: blur restores the committed bracket instead of
		// silently saving a 0-hour one.
		await bracketAmount.press(SELECT_ALL);
		await page.keyboard.press('Backspace');
		await expect(bracketAmount).toHaveValue('');
		await bracketAmount.blur();
		await expect(bracketAmount).toHaveValue('7');
		await expect(bracketUnit).toHaveText('Days');
		await expect(summary).toHaveText('≥ 168h before → 100% refund');

		// --- Cancellation deadline (emptyValue={null}, "No deadline" chip).
		const deadline = tierForm.getByLabel('Cancellation deadline before event', { exact: true });
		const deadlineUnit = tierForm.getByRole('button', {
			name: 'Cancellation deadline before event unit'
		});
		await deadline.click();
		await deadline.pressSequentially('2');
		await deadlineUnit.click();
		await page.getByRole('option', { name: 'Weeks' }).click();
		await expect(deadlineUnit).toHaveText('Weeks');

		await deadline.click();
		await deadline.press(SELECT_ALL);
		await page.keyboard.press('Backspace');
		await expect(deadline).toHaveValue('');
		// The sibling bug: clearing reset the picked unit to the default (Days).
		await expect(deadlineUnit).toHaveText('Weeks');
		await deadline.pressSequentially('1');
		await deadline.blur();
		await expect(deadline).toHaveValue('1');
		await expect(deadlineUnit).toHaveText('Weeks');

		await tierForm.getByRole('button', { name: 'Save Changes' }).click();
		await expect(tierForm).not.toBeVisible({ timeout: 15_000 });

		// Persisted in the unit that was on screen: reopen after a fresh load.
		// (Load-time smart units render 168h as 1 week and the deadline likewise.)
		await openTicketingTab(page, event.orgSlug, event.id);
		await page.getByRole('button', { name: `Edit ${tier.name}` }).click();
		await expect(tierForm).toBeVisible();
		await expect(summary).toHaveText(/^≥ 168h before → 100(\.0+)?% refund$/);
		await expect(bracketAmount).toHaveValue('1');
		await expect(bracketUnit).toHaveText('Weeks');
		await expect(deadline).toHaveValue('1');
		await expect(deadlineUnit).toHaveText('Weeks');
	});
});
