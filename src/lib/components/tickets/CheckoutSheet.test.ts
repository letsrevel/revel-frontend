/**
 * Single-ticket holder-name pre-fill (PR #1115). While the sheet is open, the
 * event requires ticket names and the cart holds exactly one ticket, the lone
 * holder-name field is pre-filled with the buyer's name: the profile name for
 * an authenticated buyer, the typed first/last name for a guest. It only ever
 * overwrites an empty field or its own previous prefill.
 */
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CheckoutSheet from './CheckoutSheet.svelte';
import { EventCart } from './cart.svelte';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import { GuestIdentity } from './guest-identity.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import * as m from '$lib/paraglide/messages.js';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

const freeTier: TierSchemaWithId = {
	id: 'tier-free',
	event_id: EVENT_ID,
	name: 'Free Entry',
	price: '0.00',
	currency: 'EUR',
	total_available: null,
	seat_assignment_mode: 'none',
	payment_method: 'free',
	allow_user_cancellation: false
};

function makeCart(quantity: number): EventCart {
	const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => null });
	cart.setQuantity(freeTier, quantity);
	return cart;
}

interface Opts {
	quantity?: number;
	requireTicketNames?: boolean;
	isAuthenticated?: boolean;
	buyerName?: string;
	identity?: GuestIdentity;
	open?: boolean;
}

function renderSheet(opts: Opts = {}) {
	const { quantity = 1, requireTicketNames = true, isAuthenticated = true, open = true } = opts;
	const cart = makeCart(quantity);
	const utils = render(CheckoutSheet, {
		props: {
			open,
			cart,
			eventId: EVENT_ID,
			requireTicketNames,
			isAuthenticated,
			authToken: isAuthenticated ? 'tok' : null,
			organizationSlug: 'acme',
			isProcessing: false,
			purchaseError: null,
			onConfirm: vi.fn().mockResolvedValue(undefined),
			registry: new CartSeatHoldRegistry(),
			identity: opts.identity,
			buyerName: opts.buyerName
		}
	});
	return { cart, ...utils };
}

const holderInput = (index = 1) =>
	screen.getByRole('textbox', { name: m['cartSheet.nameLabel']({ index }) });

describe('CheckoutSheet single-ticket holder name pre-fill', () => {
	it('pre-fills the lone holder name with the authenticated buyer name', () => {
		const { cart } = renderSheet({ buyerName: 'Ada Lovelace' });

		expect(holderInput()).toHaveValue('Ada Lovelace');
		expect(cart.groups[0].guestNames[0]).toBe('Ada Lovelace');
	});

	it('keeps what the buyer types instead of the pre-fill', async () => {
		const user = userEvent.setup();
		const { cart } = renderSheet({ buyerName: 'Ada Lovelace' });

		const input = holderInput();
		await user.clear(input);
		await user.type(input, 'Charles Babbage');

		expect(input).toHaveValue('Charles Babbage');
		expect(cart.groups[0].guestNames[0]).toBe('Charles Babbage');
	});

	it('does not instantly refill a field the buyer cleared', async () => {
		const user = userEvent.setup();
		renderSheet({ buyerName: 'Ada Lovelace' });

		const input = holderInput();
		await user.clear(input);

		expect(input).toHaveValue('');
	});

	it('leaves holder names empty for a two-ticket cart', () => {
		const { cart } = renderSheet({ quantity: 2, buyerName: 'Ada Lovelace' });

		expect(holderInput(1)).toHaveValue('');
		expect(holderInput(2)).toHaveValue('');
		expect(cart.groups[0].guestNames.filter(Boolean)).toEqual([]);
	});

	it('renders no holder inputs when the event does not require names', () => {
		const { cart } = renderSheet({ requireTicketNames: false, buyerName: 'Ada Lovelace' });

		expect(screen.queryByText(m['cartSheet.namesHeading']())).not.toBeInTheDocument();
		expect(
			screen.queryByRole('textbox', { name: m['cartSheet.nameLabel']({ index: 1 }) })
		).toBeNull();
		expect(cart.groups[0].guestNames.filter(Boolean)).toEqual([]);
	});

	it('does not pre-fill anything when the buyer has no name', () => {
		renderSheet({ buyerName: '   ' });

		expect(holderInput()).toHaveValue('');
	});

	it('does not pre-fill while the sheet is closed', () => {
		const { cart } = renderSheet({ buyerName: 'Ada Lovelace', open: false });

		expect(cart.groups[0].guestNames.filter(Boolean)).toEqual([]);
	});

	describe('guest buyer', () => {
		it('mirrors the typed first and last name until the buyer edits the holder name', async () => {
			const user = userEvent.setup();
			const identity = new GuestIdentity();
			renderSheet({ isAuthenticated: false, identity });

			expect(holderInput()).toHaveValue('');

			await user.type(screen.getByLabelText(m['guest_attendance.first_name_label']()), 'Ada');
			expect(holderInput()).toHaveValue('Ada');

			await user.type(screen.getByLabelText(m['guest_attendance.last_name_label']()), 'Lovelace');
			expect(holderInput()).toHaveValue('Ada Lovelace');

			// The buyer takes over the holder field: later identity edits no longer touch it.
			await user.clear(holderInput());
			await user.type(holderInput(), 'Charles Babbage');
			await user.type(screen.getByLabelText(m['guest_attendance.last_name_label']()), 'X');

			expect(holderInput()).toHaveValue('Charles Babbage');
		});

		it('does not use buyerName for a guest', () => {
			renderSheet({ isAuthenticated: false, identity: new GuestIdentity(), buyerName: 'Ada' });

			expect(holderInput()).toHaveValue('');
		});
	});
});
