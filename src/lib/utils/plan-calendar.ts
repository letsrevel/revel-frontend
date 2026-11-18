import * as m from '$lib/paraglide/messages.js';
import type { FirstPeriodPricing, PeriodAlignment, PeriodUnit } from '$lib/api/generated/types.gen';
import { formatDateLongMonth } from './date';
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
	if (q.pricing === 'full') return m['planCalendar.quoteFull']({ date: q.lastDay, price, regular });
	return m['planCalendar.quotePartial']({ date: q.lastDay, price, regular });
}
