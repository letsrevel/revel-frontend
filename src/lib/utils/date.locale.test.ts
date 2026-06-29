import { describe, expect, it, vi } from 'vitest';

// Configurable locale mock (the module under test reads getLocale()).
const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import { getDateLocale } from './date';

describe('getDateLocale', () => {
	it('maps fr → fr-FR (regression: French previously fell back to en-US)', () => {
		getLocale.mockReturnValue('fr');
		expect(getDateLocale()).toBe('fr-FR');
	});
	it('maps it → it-IT', () => {
		getLocale.mockReturnValue('it');
		expect(getDateLocale()).toBe('it-IT');
	});
	it('maps de → de-DE', () => {
		getLocale.mockReturnValue('de');
		expect(getDateLocale()).toBe('de-DE');
	});
	it('maps en → en-US', () => {
		getLocale.mockReturnValue('en');
		expect(getDateLocale()).toBe('en-US');
	});
	it('falls back to en-US for an unknown locale', () => {
		getLocale.mockReturnValue('xx');
		expect(getDateLocale()).toBe('en-US');
	});
});
