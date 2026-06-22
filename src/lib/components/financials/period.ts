/**
 * Period model shared by the Financials surfaces (#494).
 *
 * A period is a year plus an optional month (1–12) OR quarter (1–4). Month and
 * quarter are mutually exclusive — the backend rejects supplying both with a 422.
 */
export interface PeriodValue {
	year: number;
	month: number | null;
	quarter: number | null;
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/**
 * Convert a {@link PeriodValue} into an inclusive `YYYY-MM-DD` date range, used to
 * scope the downloadable revenue report to the same window as the on-screen view.
 *
 * - Full year (no month/quarter) → Jan 1 … Dec 31
 * - Quarter q → first day of its first month … last day of its last month
 * - Month m → first … last day of that month (leap years handled)
 */
export function periodToDateRange(value: PeriodValue): { date_from: string; date_to: string } {
	let startMonth = 1;
	let endMonth = 12;
	if (value.quarter) {
		startMonth = (value.quarter - 1) * 3 + 1;
		endMonth = startMonth + 2;
	} else if (value.month) {
		startMonth = value.month;
		endMonth = value.month;
	}
	// Day 0 of the following month is the last day of `endMonth`.
	const lastDay = new Date(value.year, endMonth, 0).getDate();
	return {
		date_from: `${value.year}-${pad(startMonth)}-01`,
		date_to: `${value.year}-${pad(endMonth)}-${pad(lastDay)}`
	};
}
