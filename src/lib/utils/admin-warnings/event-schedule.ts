import * as m from '$lib/paraglide/messages.js';
import type { AdminWarning } from './types';

/** Parses a form or API date. Empty, null or invalid values mean "unset" and return null. */
export function parseWarningDate(value: string | Date | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const time = (value instanceof Date ? value : new Date(value)).getTime();
	return Number.isNaN(time) ? null : time;
}

/** C2 (info): deadlines that fall after the event end. Skipped for open-ended or end-less events. */
export interface EventDeadlinesInput {
	is_open_ended?: boolean | null;
	end?: string | null;
	check_in_starts_at?: string | null;
	check_in_ends_at?: string | null;
	rsvp_before?: string | null;
	apply_before?: string | null;
	requires_ticket?: boolean | null;
}

function endOf(input: EventDeadlinesInput): number | null {
	if (input.is_open_ended) return null;
	return parseWarningDate(input.end);
}

function after(value: string | null | undefined, limit: number | null): boolean {
	const time = parseWarningDate(value);
	return time !== null && limit !== null && time > limit;
}

/** Check-in starts after it ends (or after the event end when there is no check-in end). */
export function checkInAfterEndWarning(input: EventDeadlinesInput): AdminWarning | null {
	// An explicit check-in end governs check-in, also for open-ended events; the
	// event end is only the fallback (and is skipped for open-ended events).
	const limit = parseWarningDate(input.check_in_ends_at) ?? endOf(input);
	if (limit === null) return null;
	if (!after(input.check_in_starts_at, limit)) return null;
	return {
		id: 'C2-checkin',
		level: 'info',
		title: () => m['adminWarnings.eventC2CheckinTitle'](),
		message: () => m['adminWarnings.eventC2CheckinMessage']()
	};
}

export function rsvpAfterEndWarning(input: EventDeadlinesInput): AdminWarning | null {
	if (!after(input.rsvp_before, endOf(input))) return null;
	return {
		id: 'C2-rsvp',
		level: 'info',
		title: () => m['adminWarnings.eventC2RsvpTitle'](),
		message: () => m['adminWarnings.eventC2RsvpMessage']()
	};
}

export function applyAfterEndWarning(input: EventDeadlinesInput): AdminWarning | null {
	if (!after(input.apply_before, endOf(input))) return null;
	return {
		id: 'C2-apply',
		level: 'info',
		title: () => m['adminWarnings.eventC2ApplyTitle'](),
		message: () => m['adminWarnings.eventC2ApplyMessage']()
	};
}

/** An RSVP deadline on a ticketed event has no effect. Does not depend on the end date. */
export function rsvpOnTicketedWarning(input: EventDeadlinesInput): AdminWarning | null {
	if (!input.requires_ticket || parseWarningDate(input.rsvp_before) === null) return null;
	return {
		id: 'C2-rsvp-ticketed',
		level: 'info',
		title: () => m['adminWarnings.eventC2RsvpTicketedTitle'](),
		message: () => m['adminWarnings.eventC2RsvpTicketedMessage']()
	};
}

/** All C2 sub-warnings that fire. */
export function eventDeadlineWarnings(input: EventDeadlinesInput): AdminWarning[] {
	return [
		checkInAfterEndWarning(input),
		rsvpAfterEndWarning(input),
		applyAfterEndWarning(input),
		rsvpOnTicketedWarning(input)
	].filter((w): w is AdminWarning => w !== null);
}

/** C4 (warn): an open ticketed event with no tier on sale and none scheduled (mirrors BE TicketSalesGate). */
export interface SalesTierInput {
	sales_paused?: boolean | null;
	sales_start_at?: string | null;
	sales_end_at?: string | null;
}

export interface NoTicketsOnSaleInput {
	status?: string | null;
	requires_ticket?: boolean | null;
	start?: string | null;
	end?: string | null;
	tiers: ReadonlyArray<SalesTierInput>;
	now: Date;
}

export function noTicketsOnSaleWarning(input: NoTicketsOnSaleInput): AdminWarning | null {
	if (input.status !== 'open' || !input.requires_ticket) return null;
	const now = input.now.getTime();
	const eventStart = parseWarningDate(input.start);
	const eventEnd = parseWarningDate(input.end) ?? eventStart;
	// A finished event is blocked by the status gate before sales matter.
	if (eventEnd !== null && eventEnd < now) return null;

	const sellsOrWillSell = input.tiers.some((tier) => {
		if (tier.sales_paused) return false;
		const start = parseWarningDate(tier.sales_start_at);
		const tierEnd = parseWarningDate(tier.sales_end_at);
		if (start === null && tierEnd === null) return true;
		// The event end caps every window: after it, the status gate blocks all sales
		// (e.g. a tier left selling after the event was moved earlier).
		const end = Math.min(tierEnd ?? eventStart ?? Infinity, eventEnd ?? Infinity);
		const from = start ?? -Infinity;
		const onSale = from <= now && now < end;
		const scheduled = start !== null && start > now && start < end;
		return onSale || scheduled;
	});
	if (sellsOrWillSell) return null;
	return {
		id: 'C4',
		level: 'warn',
		title: () => m['adminWarnings.eventC4Title'](),
		message: () => m['adminWarnings.eventC4Message']()
	};
}
