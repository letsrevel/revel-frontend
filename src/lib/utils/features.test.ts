import { describe, it, expect } from 'vitest';
import { resolveFeatures, DEFAULT_FEATURES } from './features';

describe('resolveFeatures', () => {
	it('returns defaults when given null/undefined', () => {
		expect(resolveFeatures(null)).toEqual(DEFAULT_FEATURES);
		expect(resolveFeatures(undefined)).toEqual(DEFAULT_FEATURES);
	});

	it('defaults organization_creation and telegram to true (fail-open)', () => {
		expect(DEFAULT_FEATURES.organization_creation).toBe(true);
		expect(DEFAULT_FEATURES.telegram).toBe(true);
	});

	it('defaults google_sso to false', () => {
		expect(DEFAULT_FEATURES.google_sso).toBe(false);
	});

	it('respects an explicit false override', () => {
		const result = resolveFeatures({ organization_creation: false });
		expect(result.organization_creation).toBe(false);
		// untouched flags keep defaults
		expect(result.telegram).toBe(true);
	});

	it('merges a full payload verbatim', () => {
		const raw = {
			organization_creation: false,
			telegram: false,
			google_sso: true,
			llm_evaluation: false
		};
		expect(resolveFeatures(raw)).toEqual(raw);
	});
});
