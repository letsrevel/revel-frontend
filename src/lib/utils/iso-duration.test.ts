import { describe, it, expect } from 'vitest';
import { humanizeIsoDuration, type DurationUnitLabels } from './iso-duration';

const labels: DurationUnitLabels = {
	days: (n) => `${n}D`,
	hours: (n) => `${n}H`,
	minutes: (n) => `${n}M`,
	seconds: (n) => `${n}S`
};

describe('humanizeIsoDuration', () => {
	it('returns a dash for empty input', () => {
		expect(humanizeIsoDuration(null, labels)).toBe('—');
		expect(humanizeIsoDuration(undefined, labels)).toBe('—');
		expect(humanizeIsoDuration('', labels)).toBe('—');
	});

	it('returns the raw string when it does not parse', () => {
		expect(humanizeIsoDuration('soon', labels)).toBe('soon');
	});

	it('uses the injected labels for every component', () => {
		expect(humanizeIsoDuration('P1DT2H3M4S', labels)).toBe('1D 2H 3M 4S');
	});

	it('skips zero components', () => {
		expect(humanizeIsoDuration('P0DT2H0M30S', labels)).toBe('2H 30S');
	});

	it('returns a dash when all components are zero', () => {
		expect(humanizeIsoDuration('PT0S', labels)).toBe('—');
	});
});
