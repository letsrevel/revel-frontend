/**
 * Series pass warning rules (#1314, A3, E1-E4). Pure functions: each returns an
 * `AdminWarning`, or `null` when the setting is fine. Callers add the fix
 * target and the action, and inject `now`.
 *
 * Inputs fit the saved pass (strings from the API) and the live form (strings
 * from inputs), so every number is parsed defensively. Every rule returns
 * `null` when the pass is inactive or when all covered events are past.
 */
import * as m from '$lib/paraglide/messages.js';
import { parseWarningDate } from './event-schedule';
import type { AdminWarning } from './types';
import { isOrgRestricted } from './org';

export interface SeriesPassRuleInput {
	/** `undefined` or `null` counts as active (the API default). */
	is_active?: boolean | null;
	/** Start time of each covered event (API date strings or datetime values). */
	coveredEventStarts: ReadonlyArray<string | Date | null | undefined>;
	/** Injected clock: epoch milliseconds or a `Date`. */
	now: number | Date;
}

export interface PassVisibilityInput extends SeriesPassRuleInput {
	organizationVisibility: string | null | undefined;
	visibility: string | null | undefined;
}

export interface PassScheduleInput extends SeriesPassRuleInput {
	sales_start_at?: string | Date | null;
	sales_end_at?: string | Date | null;
}

export interface PassOnlinePaymentInput extends SeriesPassRuleInput {
	payment_method: string | null | undefined;
	organizationStripeConnected: boolean;
}

export interface PassDiscountInput extends SeriesPassRuleInput {
	price: string | number | null | undefined;
	pro_rata_discount: string | number | null | undefined;
}

export interface PassTierPrice {
	price: string | number | null | undefined;
	currency: string | null | undefined;
}

export interface PassPriceVsTiersInput extends SeriesPassRuleInput {
	price: string | number | null | undefined;
	currency: string | null | undefined;
	/** One entry per resolved selection; `null` means the tier is not loaded yet. */
	selectedTiers: ReadonlyArray<PassTierPrice | null | undefined>;
}

function toNumber(value: string | number | null | undefined): number {
	if (typeof value === 'number') return value;
	const parsed = parseFloat((value ?? '').toString().trim().replace(',', '.'));
	return Number.isNaN(parsed) ? 0 : parsed;
}

function nowMs(now: number | Date): number {
	return now instanceof Date ? now.getTime() : now;
}

/** Start times (ms) of the covered events that start after `now`, latest first. */
function upcomingStarts(input: SeriesPassRuleInput): number[] {
	const now = nowMs(input.now);
	const times: number[] = [];
	for (const start of input.coveredEventStarts) {
		const time = parseWarningDate(start);
		if (time !== null && time > now) times.push(time);
	}
	return times.sort((a, b) => b - a);
}

/**
 * The pass is out of scope when it is inactive, or when it covers events and
 * all of them are past. A pass with no covered event is still in scope.
 */
function outOfScope(input: SeriesPassRuleInput): boolean {
	if (input.is_active === false) return true;
	if (input.coveredEventStarts.length === 0) return false;
	return upcomingStarts(input).length === 0 && allPast(input);
}

function allPast(input: SeriesPassRuleInput): boolean {
	const now = nowMs(input.now);
	return input.coveredEventStarts.every((start) => {
		const time = parseWarningDate(start);
		return time !== null && time <= now;
	});
}

/** A3: public or unlisted pass in an organization that outsiders cannot see. */
export function passVisibleInRestrictedOrg(input: PassVisibilityInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	if (!isOrgRestricted(input.organizationVisibility)) return null;
	if (input.visibility !== 'public' && input.visibility !== 'unlisted') return null;
	return {
		id: 'A3',
		level: 'warn',
		title: () => m['adminWarnings.seriesPassA3Title'](),
		message: () => m['adminWarnings.seriesPassA3Message']()
	};
}

/** E1a: sales end on or before the sales start. */
export function passSalesEndBeforeStart(input: PassScheduleInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	const start = parseWarningDate(input.sales_start_at);
	const end = parseWarningDate(input.sales_end_at);
	if (start === null || end === null || end > start) return null;
	return {
		id: 'E1-order',
		level: 'warn',
		title: () => m['adminWarnings.seriesPassE1OrderTitle'](),
		message: () => m['adminWarnings.seriesPassE1OrderMessage']()
	};
}

/**
 * E1b: sales open after the second-to-last upcoming covered event starts, so
 * fewer than two covered events remain. Needs two upcoming events (E2 covers fewer).
 */
export function passSalesStartTooLate(input: PassScheduleInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	const start = parseWarningDate(input.sales_start_at);
	if (start === null) return null;
	const upcoming = upcomingStarts(input);
	if (upcoming.length < 2) return null;
	if (!(start > upcoming[1])) return null;
	return {
		id: 'E1-late',
		level: 'warn',
		title: () => m['adminWarnings.seriesPassE1LateTitle'](),
		message: () => m['adminWarnings.seriesPassE1LateMessage']()
	};
}

/** E2: fewer than two covered events are still to come (saved passes). */
export function passFewUpcomingEvents(input: SeriesPassRuleInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	if (upcomingStarts(input).length >= 2) return null;
	return {
		id: 'E2',
		level: 'warn',
		title: () => m['adminWarnings.seriesPassE2Title'](),
		message: () => m['adminWarnings.seriesPassE2Message']()
	};
}

/** E3: online payment, but the organization cannot receive online payments. */
export function passOnlineWithoutStripe(input: PassOnlinePaymentInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	if (input.payment_method !== 'online' || input.organizationStripeConnected) return null;
	return {
		id: 'E3',
		level: 'warn',
		title: () => m['adminWarnings.seriesPassE3Title'](),
		message: () => m['adminWarnings.seriesPassE3Message']()
	};
}

/** E4a: the pro-rata discount takes the whole price off once two events remain. */
export function passDiscountCoversPrice(input: PassDiscountInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	const price = toNumber(input.price);
	const discount = toNumber(input.pro_rata_discount);
	const covered = input.coveredEventStarts.length;
	if (!(price > 0) || !(discount > 0) || covered < 3) return null;
	if (discount * (covered - 2) < price) return null;
	return {
		id: 'E4a',
		level: 'info',
		title: () => m['adminWarnings.seriesPassE4aTitle'](),
		message: () => m['adminWarnings.seriesPassE4aMessage']()
	};
}

/**
 * E4b (create mode): the pass costs more than the tickets it replaces. Needs
 * two resolved selections in the pass currency.
 */
export function passPriceAboveTiersSum(input: PassPriceVsTiersInput): AdminWarning | null {
	if (outOfScope(input)) return null;
	const tiers = input.selectedTiers;
	if (tiers.length < 2) return null;
	const currency = (input.currency ?? '').toUpperCase();
	let sum = 0;
	for (const tier of tiers) {
		if (!tier || (tier.currency ?? '').toUpperCase() !== currency) return null;
		sum += toNumber(tier.price);
	}
	if (!(toNumber(input.price) > sum)) return null;
	return {
		id: 'E4b',
		level: 'info',
		title: () => m['adminWarnings.seriesPassE4bTitle'](),
		message: () => m['adminWarnings.seriesPassE4bMessage']()
	};
}
