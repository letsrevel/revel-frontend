import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import OrganizationFilters from './OrganizationFilters.svelte';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';

// CityFilter loads the selected city's name with TanStack Query: keep that
// off the network.
vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	cityGetCity: vi.fn().mockResolvedValue({ data: { id: 123, name: 'Vienna', country: 'Austria' } })
}));

function renderWithQuery(options: { props: Record<string, unknown> }) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: OrganizationFilters,
			componentProps: options.props
		}
	});
}

describe('OrganizationFilters', () => {
	const defaultFilters: FilterState = {
		orderBy: 'distance',
		page: 1,
		pageSize: 20
	};

	it('renders filter sections', () => {
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		renderWithQuery({
			props: {
				filters: defaultFilters,
				onUpdateFilters,
				onClearFilters
			}
		});

		expect(screen.getByRole('complementary', { name: 'Organization filters' })).toBeInTheDocument();
		expect(screen.getByText('Filters')).toBeInTheDocument();
		expect(screen.getByText('Sort Order')).toBeInTheDocument();
		expect(screen.getByText('Search')).toBeInTheDocument();
		expect(screen.getByText('Location')).toBeInTheDocument();
		expect(screen.getByText('Tags')).toBeInTheDocument();
	});

	it('displays active filter count', () => {
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		const filtersWithActive: FilterState = {
			...defaultFilters,
			search: 'test',
			tags: ['LGBTQ+', 'Community']
		};

		renderWithQuery({
			props: {
				filters: filtersWithActive,
				onUpdateFilters,
				onClearFilters
			}
		});

		// search (1) + 2 tags = 3 active filters
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('shows clear all button when filters are active', () => {
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		const filtersWithActive: FilterState = {
			...defaultFilters,
			search: 'test'
		};

		renderWithQuery({
			props: {
				filters: filtersWithActive,
				onUpdateFilters,
				onClearFilters
			}
		});

		expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
	});

	it('hides clear all button when no filters are active', () => {
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		renderWithQuery({
			props: {
				filters: defaultFilters,
				onUpdateFilters,
				onClearFilters
			}
		});

		expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
	});

	it('calls onClearFilters when clear all is clicked', async () => {
		const user = userEvent.setup();
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		const filtersWithActive: FilterState = {
			...defaultFilters,
			search: 'test'
		};

		renderWithQuery({
			props: {
				filters: filtersWithActive,
				onUpdateFilters,
				onClearFilters
			}
		});

		const clearButton = screen.getByRole('button', { name: /clear all/i });
		await user.click(clearButton);

		expect(onClearFilters).toHaveBeenCalledTimes(1);
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		renderWithQuery({
			props: {
				filters: defaultFilters,
				onUpdateFilters,
				onClearFilters
			}
		});

		// Tab through interactive elements in DOM order:
		// city search input → sort-order info button → order-by select
		await user.tab();
		expect(screen.getByRole('textbox', { name: 'Search for a city' })).toHaveFocus();
		await user.tab();
		expect(screen.getByRole('button', { name: 'Sort order information' })).toHaveFocus();
		await user.tab();
		expect(screen.getByRole('combobox')).toHaveFocus(); // Order by select
	});

	it('displays footer hint with active filter count', () => {
		const onUpdateFilters = vi.fn();
		const onClearFilters = vi.fn();

		const filtersWithActive: FilterState = {
			...defaultFilters,
			search: 'test',
			cityId: 123
		};

		renderWithQuery({
			props: {
				filters: filtersWithActive,
				onUpdateFilters,
				onClearFilters
			}
		});

		expect(screen.getByText('2 filters applied')).toBeInTheDocument();
	});
});
