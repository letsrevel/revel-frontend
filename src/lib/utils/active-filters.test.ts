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

// Calendar view hides the list-only controls (sort, include-past, search), because
// the calendar endpoint ignores them. A hidden control must not count (#1297).
describe('ignoreListOnly option', () => {
	it('excludes includePast from count and hasActive when asked', () => {
		const f = { includePast: true };
		expect(countActiveFilters(f)).toBe(1);
		expect(hasActiveFilters(f)).toBe(true);
		expect(countActiveFilters(f, { ignoreListOnly: true })).toBe(0);
		expect(hasActiveFilters(f, { ignoreListOnly: true })).toBe(false);
	});

	it('excludes search from count and hasActive when asked', () => {
		const f = { search: 'jazz' };
		expect(countActiveFilters(f)).toBe(1);
		expect(hasActiveFilters(f)).toBe(true);
		expect(countActiveFilters(f, { ignoreListOnly: true })).toBe(0);
		expect(hasActiveFilters(f, { ignoreListOnly: true })).toBe(false);
	});

	it('still counts the filters the calendar applies', () => {
		const f = { includePast: true, search: 'x', cityId: 7, ticketType: 'free' as const };
		expect(countActiveFilters(f)).toBe(4);
		expect(countActiveFilters(f, { ignoreListOnly: true })).toBe(2);
		expect(hasActiveFilters(f, { ignoreListOnly: true })).toBe(true);
	});
});
