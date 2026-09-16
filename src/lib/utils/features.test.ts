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

	it('respects an explicit false override', () => {
		const result = resolveFeatures({ organization_creation: false });
		expect(result.organization_creation).toBe(false);
		// untouched flags keep defaults
		expect(result.telegram).toBe(true);
	});

	it('defaults referral_applications to false (the one fail-CLOSED flag)', () => {
		// Its surfaces 404 when the backend flag is off, so hiding them on a
		// `/version` blip beats linking to a dead route. See features.ts.
		expect(DEFAULT_FEATURES.referral_applications).toBe(false);
		expect(resolveFeatures({}).referral_applications).toBe(false);
	});

	it('respects an explicit referral_applications: true', () => {
		expect(resolveFeatures({ referral_applications: true }).referral_applications).toBe(true);
	});

	it('merges a full payload verbatim', () => {
		const raw = {
			organization_creation: false,
			telegram: false,
			llm_evaluation: false,
			referral_applications: true
		};
		expect(resolveFeatures(raw)).toEqual(raw);
	});
});
