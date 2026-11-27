import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import EventFilters from './EventFilters.svelte';
import MobileFilterSheet from './MobileFilterSheet.svelte';
import * as m from '$lib/paraglide/messages.js';

const { cityGetCity, cityListCities, tagListTags, organizationListOrganizations } = vi.hoisted(
	() => ({
		cityGetCity: vi.fn(),
		cityListCities: vi.fn(),
		tagListTags: vi.fn(),
		organizationListOrganizations: vi.fn()
	})
);
vi.mock('$lib/api', () => ({
	cityGetCity,
	cityListCities,
	tagListTags,
	organizationListOrganizations
}));

function renderWith(component: unknown, props: Record<string, unknown>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: { client, component, componentProps: props }
	});
}

const baseProps = {
	filters: { search: 'jazz' },
	onUpdateFilters: vi.fn(),
	onClearFilters: vi.fn()
};

// Calendar view: /api/events/calendar takes no `search`, so the field would
// change the URL and the badge but not the events (#1297). It must not show.
describe.each([
	['EventFilters', EventFilters, {}],
	['MobileFilterSheet', MobileFilterSheet, { isOpen: true, totalCount: 0, onClose: vi.fn() }]
])('%s search field', (_name, component, extra) => {
	beforeEach(() => {
		const empty = { data: { results: [], count: 0 } };
		cityListCities.mockResolvedValue(empty);
		tagListTags.mockResolvedValue(empty);
		organizationListOrganizations.mockResolvedValue(empty);
	});

	it('shows the search field in list view', () => {
		renderWith(component, { ...baseProps, ...extra });
		expect(screen.getByRole('searchbox')).toBeInTheDocument();
	});

	it('hides the search field in calendar view', () => {
		renderWith(component, { ...baseProps, ...extra, hideListControls: true });
		expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
	});

	it('counts the search and offers Clear all in list view', () => {
		renderWith(component, { ...baseProps, ...extra });
		expect(
			screen.getAllByRole('button', { name: new RegExp(m['common.filters_clearAll']()) }).length
		).toBeGreaterThan(0);
		expect(screen.getByLabelText(`1 ${m['common.filters_activeFilters']()}`)).toBeInTheDocument();
	});

	it('neither counts the search nor offers Clear all in calendar view', () => {
		renderWith(component, { ...baseProps, ...extra, hideListControls: true });
		expect(
			screen.queryAllByRole('button', { name: new RegExp(m['common.filters_clearAll']()) })
		).toHaveLength(0);
		expect(
			screen.queryByLabelText(`1 ${m['common.filters_activeFilters']()}`)
		).not.toBeInTheDocument();
	});
});
