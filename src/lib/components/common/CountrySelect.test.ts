import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import CountrySelect from './CountrySelect.svelte';

describe('CountrySelect', () => {
	it('renders an empty placeholder option first and sorted localized names', () => {
		render(CountrySelect, { id: 'c' });
		const select = screen.getByRole('combobox') as HTMLSelectElement;
		expect(select.options[0].value).toBe('');
		const names = Array.from(select.options)
			.slice(1)
			.map((o) => o.textContent ?? '');
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en-US')));
		expect(screen.getByRole('option', { name: 'Italy' })).toBeInTheDocument();
	});

	it('selects the given value and normalises legacy EL to GR', () => {
		render(CountrySelect, { id: 'c', value: 'EL' });
		expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('GR');
	});

	it('keeps an unknown value visible', () => {
		render(CountrySelect, { id: 'c', value: 'XK' });
		expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('XK');
	});

	it('applies required, invalid and describedBy attributes', () => {
		render(CountrySelect, { id: 'c', required: true, invalid: true, describedBy: 'err' });
		const select = screen.getByRole('combobox');
		expect(select).toBeRequired();
		expect(select).toHaveAttribute('aria-invalid', 'true');
		expect(select).toHaveAttribute('aria-describedby', 'err');
	});

	it('updates the bound value on change', async () => {
		render(CountrySelect, { id: 'c' });
		const select = screen.getByRole('combobox') as HTMLSelectElement;
		await userEvent.selectOptions(select, 'DE');
		expect(select.value).toBe('DE');
	});
});
