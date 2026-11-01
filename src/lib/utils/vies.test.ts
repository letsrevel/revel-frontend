import { describe, it, expect } from 'vitest';
import { viesUnavailableCode, viesUnavailableDetail, viesOutcome } from './vies';

describe('viesUnavailableCode', () => {
	it.each([
		'vies_unavailable_saved_pending',
		'vies_unavailable_saved_unvalidated',
		'vies_unavailable_not_saved'
	])('returns known code %s', (code) => {
		expect(viesUnavailableCode({ detail: 'x', code })).toBe(code);
	});

	it.each([null, undefined, 'str', 42, {}, { code: 'nope' }, { code: 5 }])(
		'returns null for %j',
		(v) => {
			expect(viesUnavailableCode(v)).toBeNull();
		}
	);
});

describe('viesUnavailableDetail', () => {
	it('returns the detail string', () => {
		expect(viesUnavailableDetail({ detail: 'Down' })).toBe('Down');
	});
	it('returns empty string otherwise', () => {
		expect(viesUnavailableDetail(null)).toBe('');
		expect(viesUnavailableDetail({ detail: 3 })).toBe('');
		expect(viesUnavailableDetail({})).toBe('');
	});
});

describe('viesOutcome', () => {
	it('maps codes to outcomes', () => {
		expect(viesOutcome('vies_unavailable_saved_pending')).toBe('pending');
		expect(viesOutcome('vies_unavailable_saved_unvalidated')).toBe('unvalidated');
		expect(viesOutcome('vies_unavailable_not_saved')).toBe('not_saved');
	});
	it('falls back to the given default for unknown (null) codes', () => {
		expect(viesOutcome(null, 'pending')).toBe('pending');
		expect(viesOutcome(null, 'unvalidated')).toBe('unvalidated');
	});
});
