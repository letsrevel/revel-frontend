import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as runtime from '$lib/paraglide/runtime.js';
import { formatPlanPrice } from './subscriptions';

// Both `getDateLocale` (via date.ts) and the compiled paraglide messages read
// the active language from the runtime, so one override drives both halves of
// the price string. This goes through Paraglide's own `overwriteGetLocale`
// rather than `vi.mock`: Vitest loads src/lib/paraglide outside its module
// graph (see vite.config.ts), so the messages' internal runtime import never
// sees a mock. The runtime is shared by every file in the worker, hence the
// restore in afterAll.
const getLocale = vi.fn((): runtime.Locale => 'en');
const originalGetLocale = runtime.getLocale;
beforeAll(() => runtime.overwriteGetLocale(getLocale));
afterAll(() => runtime.overwriteGetLocale(originalGetLocale));

// Intl separates the amount from "€" with a NO-BREAK SPACE (U+00A0) in de/it/fr;
// spelling it out keeps these assertions honest and greppable.
const NBSP = '\u00a0';

const plan = {
	price: '10.00',
	currency: 'EUR',
	period_unit: 'month',
	period_count: 1
} as const;

// Regression: the amount was pinned to the UI language while the period label
// was a hardcoded English table, so a German member read "€10.00 / month".
describe('formatPlanPrice locale switching', () => {
	it('en → English label and en-US currency placement', () => {
		getLocale.mockReturnValue('en');
		expect(formatPlanPrice(plan)).toBe('€10.00 / month');
	});

	it('de → German label and German currency placement', () => {
		getLocale.mockReturnValue('de');
		expect(formatPlanPrice(plan)).toBe(`10,00${NBSP}€ / Monat`);
	});

	it('de → pluralised German label for a multi-period plan', () => {
		getLocale.mockReturnValue('de');
		expect(formatPlanPrice({ ...plan, period_count: 3 })).toBe(`10,00${NBSP}€ / 3 Monate`);
	});

	it('it → Italian label', () => {
		getLocale.mockReturnValue('it');
		expect(formatPlanPrice({ ...plan, period_unit: 'year', period_count: 2 })).toBe(
			`10,00${NBSP}€ / 2 anni`
		);
	});

	it('fr → French label', () => {
		getLocale.mockReturnValue('fr');
		expect(formatPlanPrice({ ...plan, period_unit: 'year', period_count: 1 })).toBe(
			`10,00${NBSP}€ / an`
		);
	});
});
