import { describe, it, expect } from 'vitest';
import { parseOrganizationFilters } from './organizationFilters';

describe('parseOrganizationFilters tags', () => {
	it('drops case duplicates and keeps the first spelling', () => {
		const filters = parseOrganizationFilters(new URLSearchParams('tags=fun,Fun,FUN,x'));
		expect(filters.tags).toEqual(['fun', 'x']);
	});

	it.each(['%23', '%20'])('gives no tags for ?tags=%s', (raw) => {
		const filters = parseOrganizationFilters(
			new URLSearchParams(`tags=${decodeURIComponent(raw)}`)
		);
		expect(filters.tags).toBeUndefined();
	});
});
