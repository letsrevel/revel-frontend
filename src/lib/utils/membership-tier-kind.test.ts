import { describe, expect, it } from 'vitest';
import { standardTiers } from './membership-tier-kind';

describe('standardTiers', () => {
	const tiers = [
		{ id: 'a', kind: 'standard' as const },
		{ id: 'b', kind: 'temporary' as const },
		{ id: 'c', kind: 'standard' as const }
	];

	it('keeps only standard tiers, in order', () => {
		expect(standardTiers(tiers).map((t) => t.id)).toEqual(['a', 'c']);
	});

	it('returns an empty list for nullish or all-temporary input', () => {
		expect(standardTiers(null)).toEqual([]);
		expect(standardTiers(undefined)).toEqual([]);
		expect(standardTiers([{ kind: 'temporary' as const }])).toEqual([]);
	});
});
