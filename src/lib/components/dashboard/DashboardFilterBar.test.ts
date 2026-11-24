import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DashboardFilterBar from './DashboardFilterBar.svelte';

const groups = (onSelect = vi.fn()) => [
	{
		id: 'status',
		label: 'Status',
		chips: [
			{ label: 'All', active: true, onSelect },
			{ label: 'Active', active: false, onSelect }
		]
	}
];

describe('DashboardFilterBar', () => {
	it('renders a labelled chip group with aria-pressed chips', () => {
		render(DashboardFilterBar, { chipGroups: groups() });

		const group = screen.getByRole('group', { name: 'Status' });
		expect(group).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('calls the chip handler when a chip is pressed', async () => {
		const onSelect = vi.fn();
		render(DashboardFilterBar, { chipGroups: groups(onSelect) });

		await userEvent.click(screen.getByRole('button', { name: 'Active' }));

		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it('shows the clear button only when a filter is active', async () => {
		const onClear = vi.fn();
		const { rerender } = render(DashboardFilterBar, {
			hasActiveFilters: false,
			onClear,
			clearLabel: 'Clear Filters'
		});
		expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();

		await rerender({ hasActiveFilters: true, onClear, clearLabel: 'Clear Filters' });
		await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it('renders the result count in a polite live region', () => {
		render(DashboardFilterBar, { resultCount: 'Showing 1 of 3 tickets' });

		const line = screen.getByText('Showing 1 of 3 tickets');
		expect(line).toHaveAttribute('aria-live', 'polite');
	});

	it('omits the count line when no count is given', () => {
		render(DashboardFilterBar, {});
		expect(screen.queryByTestId('filter-result-count')).not.toBeInTheDocument();
	});

	it('reports search input through onSearch', async () => {
		const onSearch = vi.fn();
		render(DashboardFilterBar, { onSearch, searchLabel: 'Search', searchPlaceholder: 'Search' });

		await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'ab');

		expect(onSearch).toHaveBeenLastCalledWith('ab');
	});
});
