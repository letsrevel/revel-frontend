import { describe, expect, it, vi } from 'vitest';

// Per-test locale switching, same pattern as date.format.locale.test.ts.
const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import { formatMoney, formatMoneyRange } from './format';

// Intl inserts a NARROW NO-BREAK / NO-BREAK space before a trailing symbol in
// some locales; normalise so assertions stay readable.
const norm = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatMoney / formatMoneyRange locale switching (#949)', () => {
	it('en → symbol first, dot decimals', () => {
		getLocale.mockReturnValue('en');
		expect(formatMoney(18, 'EUR')).toBe('€18.00');
		expect(formatMoneyRange(20, 45, 'EUR')).toBe('€20.00 \u2013 €45.00');
	});

	it('de → symbol last, comma decimals (never "EUR 18.00")', () => {
		getLocale.mockReturnValue('de');
		expect(norm(formatMoney(18, 'EUR'))).toBe('18,00 €');
		expect(norm(formatMoneyRange('20.00', '45.00', 'EUR'))).toBe('20,00 € \u2013 45,00 €');
	});
});
