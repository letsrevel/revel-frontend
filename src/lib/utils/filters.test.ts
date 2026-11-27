import { describe, it, expect } from 'vitest';
import { parseFilters } from './filters';

describe('parseFilters tags', () => {
	it('drops case duplicates and keeps the first spelling', () => {
		const filters = parseFilters(new URLSearchParams('tags=fun,Fun,FUN,x'));
		expect(filters.tags).toEqual(['fun', 'x']);
	});
});
