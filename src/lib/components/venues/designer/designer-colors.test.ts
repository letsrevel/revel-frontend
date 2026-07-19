import { describe, it, expect } from 'vitest';
import type { PriceCategorySchema } from '$lib/api/generated/types.gen';
import { buildCategoryStyleMap, resolveSeatCategory } from './designer-colors';

function category(overrides: Partial<PriceCategorySchema> = {}): PriceCategorySchema {
	return { id: 'cat-1', name: 'Gold', color: '#d4af37', display_order: 0, ...overrides };
}

describe('buildCategoryStyleMap', () => {
	it('maps each category id to its color and name', () => {
		const map = buildCategoryStyleMap([
			category({ id: 'gold', name: 'Gold', color: '#d4af37' }),
			category({ id: 'silver', name: 'Silver', color: '#c0c0c0' })
		]);
		expect(map.get('gold')).toEqual({ color: '#d4af37', name: 'Gold' });
		expect(map.get('silver')).toEqual({ color: '#c0c0c0', name: 'Silver' });
		expect(map.size).toBe(2);
	});

	it('skips categories without a stable id', () => {
		const map = buildCategoryStyleMap([
			category({ id: null, name: 'No id', color: '#000000' }),
			category({ id: '', name: 'Empty id', color: '#111111' }),
			category({ id: 'ok', name: 'Ok', color: '#222222' })
		]);
		expect(map.size).toBe(1);
		expect(map.has('ok')).toBe(true);
	});
});

describe('resolveSeatCategory', () => {
	const styles = buildCategoryStyleMap([category({ id: 'gold', name: 'Gold', color: '#d4af37' })]);

	it('resolves a painted seat to its color + name (for the a11y pairing)', () => {
		expect(resolveSeatCategory('gold', styles)).toEqual({ color: '#d4af37', name: 'Gold' });
	});

	it('treats an unpainted seat (null/undefined) as neutral', () => {
		expect(resolveSeatCategory(null, styles)).toBeNull();
		expect(resolveSeatCategory(undefined, styles)).toBeNull();
	});

	it('treats an unknown category id as neutral', () => {
		expect(resolveSeatCategory('does-not-exist', styles)).toBeNull();
	});
});
