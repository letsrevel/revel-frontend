import { describe, expect, it, vi } from 'vitest';

// Same hoisted-mock pattern as date.format.locale.test.ts: both `getDateLocale`
// (via date.ts) and the compiled paraglide messages read the active language
// from this module, so one mock drives both halves of the price string.
const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({
	getLocale,
	experimentalStaticLocale: undefined
}));

import { formatPlanPrice } from './subscriptions';

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
