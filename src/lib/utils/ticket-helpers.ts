import * as m from '$lib/paraglide/messages.js';
import { getUserDisplayName } from '$lib/utils/user-display';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Get guest name if different from user display name
 */
export function getGuestNameIfDifferent(ticket: any): string | null {
	const guestName = ticket.guest_name;
	if (!guestName) return null;
	const userDisplayName = getUserDisplayName(ticket.user, m['eventTicketsAdmin.unknownUser']());
	if (guestName.toLowerCase().trim() === userDisplayName.toLowerCase().trim()) return null;
	return guestName;
}

/**
 * Get venue/sector/seat display info from tier and seat
 */
export function getSeatDisplay(ticket: any): string | null {
	const tier = ticket.tier;
	const seat = ticket.seat;

	if (!tier?.venue && !tier?.sector && !seat) return null;

	const parts: string[] = [];

	if (tier?.venue?.name) parts.push(tier.venue.name);
	if (tier?.sector?.name) parts.push(tier.sector.name);

	if (seat) {
		if (seat.row) parts.push(`Row ${seat.row}`);
		if (seat.number) parts.push(`Seat ${seat.number}`);
		if (seat.label && !seat.row && !seat.number) parts.push(seat.label);
		if (seat.is_accessible) parts.push('\u267F');
		if (seat.is_obstructed_view) parts.push('\u26A0\uFE0F Obstructed');
	}

	return parts.length > 0 ? parts.join(' \u2022 ') : null;
}

/**
 * Get the effective price for a ticket.
 * Priority: payment.amount > price_paid > tier.price
 */
export function getTicketPrice(ticket: any): number | string | undefined {
	if (ticket.payment?.amount !== undefined && ticket.payment?.amount !== null) {
		return ticket.payment.amount;
	}
	if (ticket.price_paid !== undefined && ticket.price_paid !== null) {
		return ticket.price_paid;
	}
	return ticket.tier?.price;
}

/**
 * Check if ticket can be checked in
 */
export function canCheckIn(ticket: any): boolean {
	return ticket.status === 'active' || needsPaymentConfirmation(ticket);
}

/**
 * Check if payment needs confirmation at check-in
 */
export function needsPaymentConfirmation(ticket: any): boolean {
	const method = ticket.tier?.payment_method;
	return ticket.status === 'pending' && (method === 'offline' || method === 'at_the_door');
}

/**
 * Check if payment can be confirmed
 */
export function canConfirmPayment(ticket: any): boolean {
	const method = ticket.tier?.payment_method;
	return (
		(ticket.status === 'pending' || ticket.status === 'cancelled') &&
		(method === 'offline' || method === 'at_the_door')
	);
}

/**
 * Check if ticket can be managed (non-Stripe)
 */
export function canManageTicket(ticket: any): boolean {
	const method = ticket.tier?.payment_method;
	return method === 'offline' || method === 'at_the_door' || method === 'free';
}

/**
 * Check if payment can be unconfirmed (active ticket with offline/at_the_door payment)
 */
export function canUnconfirmPayment(ticket: any): boolean {
	const method = ticket.tier?.payment_method;
	return ticket.status === 'active' && (method === 'offline' || method === 'at_the_door');
}

/**
 * Check if a ticket's tier is PWYC with offline/at_the_door payment
 */
export function isPwycTicket(ticket: any): boolean {
	return (
		ticket.tier?.price_type === 'pwyc' &&
		(ticket.tier?.payment_method === 'offline' || ticket.tier?.payment_method === 'at_the_door')
	);
}

/**
 * Get PWYC range warning message, if applicable
 */
export function getPwycWarning(ticket: any, value: string): string | null {
	const num = parseFloat(value);
	if (isNaN(num) || num <= 0) return null;

	const min = ticket.tier?.pwyc_min ? parseFloat(ticket.tier.pwyc_min) : null;
	const max = ticket.tier?.pwyc_max ? parseFloat(ticket.tier.pwyc_max) : null;

	const currency = ticket.tier?.currency?.toUpperCase() || 'EUR';
	const fmt = (v: number) =>
		new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);

	if (min !== null && max !== null && (num < min || num > max)) {
		return `This amount is outside the suggested range (${fmt(min)} \u2013 ${fmt(max)})`;
	}
	if (min !== null && max === null && num < min) {
		return `This amount is below the suggested minimum (${fmt(min)})`;
	}
	return null;
}

/**
 * Get payment method label
 */
export function getPaymentMethodLabel(method: string): string {
	switch (method) {
		case 'online':
			return m['eventTicketsAdmin.paymentOnline']();
		case 'offline':
			return m['eventTicketsAdmin.paymentOffline']();
		case 'at_the_door':
			return m['eventTicketsAdmin.paymentAtDoor']();
		case 'free':
			return m['eventTicketsAdmin.paymentFree']();
		default:
			return method;
	}
}
