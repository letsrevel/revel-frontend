import * as m from '$lib/paraglide/messages.js';
import type { FirstPeriodPricing, PeriodAlignment, PeriodUnit } from '$lib/api/generated/types.gen';
import { formatDate, formatDateLongMonth } from './date';
import { formatMonthName } from './calendar';
import { formatMoney } from './format';

/** The alignment fields every plan schema carries (missing = rolling). */
export interface PlanAlignmentFields {
	period_alignment?: PeriodAlignment;
	period_unit?: PeriodUnit;
	calendar_start_month?: number | null;
}

/** Plans that also carry the "if you join now" first-period quote. */
export interface PlanQuoteFields extends PlanAlignmentFields {
	first_period_end?: string | null;
	first_period_price?: string | null;
	first_period_pricing?: FirstPeriodPricing;
}

export function isCalendarPlan(plan: PlanAlignmentFields): boolean {
	return plan.period_alignment === 'calendar';
}

/**
 * Mirrors the backend `same_period_grid`: an online switch is only legal
 * between two rolling plans, or two calendar plans on the same unit and start month.
 */
export function samePeriodGrid(a: PlanAlignmentFields, b: PlanAlignmentFields): boolean {
	const aCal = isCalendarPlan(a);
	if (aCal !== isCalendarPlan(b)) return false;
	if (!aCal) return true;
	return (
		a.period_unit === b.period_unit &&
		(a.calendar_start_month ?? null) === (b.calendar_start_month ?? null)
	);
}

/**
 * `first_period_end` is exclusive (00:00 UTC on the 1st of the next period), so
 * the inclusive last day is one millisecond earlier, rendered as a UTC date.
 */
export function formatPeriodLastDay(endIso: string): string {
	return formatDateLongMonth(new Date(Date.parse(endIso) - 1).toISOString(), 'UTC');
}

/** Short billing-calendar label, or null for rolling plans. */
export function calendarAlignmentLabel(plan: PlanAlignmentFields): string | null {
	if (!isCalendarPlan(plan)) return null;
	if (plan.period_unit === 'year') {
		return m['planCalendar.calendarYear']({
			month: formatMonthName(plan.calendar_start_month ?? 1)
		});
	}
	return m['planCalendar.calendarMonth']();
}

export interface FirstPeriodQuote {
	lastDay: string;
	price: string;
	isFree: boolean;
	pricing: FirstPeriodPricing;
}

/** The join-now quote for a calendar plan; null when there is nothing to quote. */
export function firstPeriodQuote(plan: PlanQuoteFields): FirstPeriodQuote | null {
	if (!isCalendarPlan(plan) || !plan.first_period_end) return null;
	const price = plan.first_period_price ?? '0';
	return {
		lastDay: formatPeriodLastDay(plan.first_period_end),
		price,
		isFree: Number(price) === 0,
		pricing: plan.first_period_pricing ?? 'prorated'
	};
}

export interface QuotablePlan extends PlanQuoteFields {
	currency: string;
}

/**
 * The join-now sentence for a calendar plan ("First period until 31 December
 * 2026: €12.50, then ..."), or null when there is nothing to quote. `regular`
 * is the plan's own formatted price (`formatPlanPrice`).
 */
export function firstPeriodQuoteText(plan: QuotablePlan, regular: string): string | null {
	const q = firstPeriodQuote(plan);
	if (!q) return null;
	const price = formatMoney(q.price, plan.currency);
	if (q.isFree) return m['planCalendar.quoteFree']({ date: q.lastDay, regular });
	if (q.pricing === 'full') return m['planCalendar.quoteFull']({ date: q.lastDay, price });
	return m['planCalendar.quotePartial']({ date: q.lastDay, price, regular });
}

/**
 * Formats a subscription period boundary. Rolling plans keep the viewer's local
 * timezone. Calendar plans have boundaries at exactly 00:00 UTC on the 1st, so
 * they are rendered in UTC (a viewer west of UTC would otherwise see the day
 * before). `start` is the boundary itself ("renews on", "switching on"); `end`
 * is the inclusive last day (boundary minus 1 ms), for "until"/"ends on" wording.
 */
export function formatPlanBoundary(
	iso: string,
	plan: PlanAlignmentFields | null | undefined,
	kind: 'start' | 'end',
	style: 'short' | 'long' = 'short'
): string {
	const fmt = style === 'long' ? formatDateLongMonth : formatDate;
	if (!plan || !isCalendarPlan(plan)) return fmt(iso);
	const t = Date.parse(iso);
	return fmt(new Date(kind === 'end' ? t - 1 : t).toISOString(), 'UTC');
}

/** Date-line kinds whose date is a period boundary, mapped to start/end wording. */
const BOUNDARY_KIND: Record<string, 'start' | 'end'> = {
	renewal: 'start',
	cancels: 'end',
	period_ends: 'end'
};

/** Date for a `getDateLine` row; only boundary kinds get the calendar-plan treatment. */
export function formatDateLineDate(
	line: { kind: string; date: string | null },
	plan: PlanAlignmentFields | null | undefined,
	style: 'short' | 'long' = 'short'
): string {
	if (!line.date) return '—';
	const kind = BOUNDARY_KIND[line.kind];
	if (!kind) return (style === 'long' ? formatDateLongMonth : formatDate)(line.date);
	return formatPlanBoundary(line.date, plan, kind, style);
}
