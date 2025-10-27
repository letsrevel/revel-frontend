import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import OrganizationOrderByFilter from './OrganizationOrderByFilter.svelte';

describe('OrganizationOrderByFilter', () => {
	it('renders with default order by value', () => {
		const onChangeOrderBy = vi.fn();
		render(OrganizationOrderByFilter, {
			props: {
				orderBy: 'distance',
				onChangeOrderBy
			}
		});

		expect(screen.getByRole('combobox', { name: 'Sort order' })).toBeInTheDocument();
		expect(screen.getByText('Nearest First')).toBeInTheDocument();
	});

	it('displays all sorting options', () => {
		const onChangeOrderBy = vi.fn();
		render(OrganizationOrderByFilter, {
			props: {
				orderBy: 'distance',
				onChangeOrderBy
			}
		});

		const select = screen.getByRole('combobox') as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.text);

		expect(options).toContain('Nearest First');
		expect(options).toContain('A-Z');
		expect(options).toContain('Z-A');
	});

	it('calls onChangeOrderBy when selection changes', async () => {
		const user = userEvent.setup();
		const onChangeOrderBy = vi.fn();

		render(OrganizationOrderByFilter, {
			props: {
				orderBy: 'distance',
				onChangeOrderBy
			}
		});

		const select = screen.getByRole('combobox');
		await user.selectOptions(select, 'name');

		expect(onChangeOrderBy).toHaveBeenCalledWith('name');
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const onChangeOrderBy = vi.fn();

		render(OrganizationOrderByFilter, {
			props: {
				orderBy: 'distance',
				onChangeOrderBy
			}
		});

		const select = screen.getByRole('combobox');
		await user.tab();
		expect(select).toHaveFocus();
	});

	it('shows tooltip on info button hover', async () => {
		const user = userEvent.setup();
		const onChangeOrderBy = vi.fn();

		render(OrganizationOrderByFilter, {
			props: {
				orderBy: 'distance',
				onChangeOrderBy
			}
		});

		const infoButton = screen.getByRole('button', { name: 'Sort order information' });
		await user.hover(infoButton);

		expect(screen.getByText('Distance Sorting')).toBeInTheDocument();
	});
});
