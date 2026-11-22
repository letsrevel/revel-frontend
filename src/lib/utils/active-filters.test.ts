import { describe, it, expect } from 'vitest';
import { countActiveFilters, hasActiveFilters } from './filters';
import {
	countActiveOrganizationFilters,
	hasActiveOrganizationFilters
} from './organizationFilters';

// Sort order changes the order of the results, not which results show, so it
// is not a filter: it must not raise the "Filters" badge or show "Clear all".
describe('active filter count ignores the sort order', () => {
	it('events: a sort order alone is no active filter', () => {
		expect(countActiveFilters({ orderBy: 'start' })).toBe(0);
		expect(hasActiveFilters({ orderBy: '-start' })).toBe(false);
	});

	it('events: a city plus a sort order counts one filter', () => {
		expect(countActiveFilters({ cityId: 7, orderBy: 'start' })).toBe(1);
		expect(hasActiveFilters({ cityId: 7, orderBy: 'start' })).toBe(true);
	});

	it('organizations: a sort order alone is no active filter', () => {
		expect(countActiveOrganizationFilters({ orderBy: 'name' })).toBe(0);
		expect(hasActiveOrganizationFilters({ orderBy: '-name' })).toBe(false);
		expect(countActiveOrganizationFilters({ cityId: 7, orderBy: 'name' })).toBe(1);
	});
});
