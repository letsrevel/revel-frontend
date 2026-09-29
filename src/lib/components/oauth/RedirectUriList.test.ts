import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RedirectUriList from './RedirectUriList.svelte';

describe('RedirectUriList', () => {
	it('renders one labelled input per URI with the hint', () => {
		render(RedirectUriList, {
			props: {
				value: ['https://a.example/cb', 'https://b.example/cb'],
				onChange: vi.fn(),
				clientType: 'public'
			}
		});
		expect(screen.getByRole('textbox', { name: 'Redirect URI 1' })).toHaveValue(
			'https://a.example/cb'
		);
		expect(screen.getByRole('textbox', { name: 'Redirect URI 2' })).toHaveValue(
			'https://b.example/cb'
		);
		expect(screen.getByText(/http on localhost/)).toBeInTheDocument();
	});

	it('adds and removes rows through onChange and caps at 10', async () => {
		const onChange = vi.fn();
		const first = render(RedirectUriList, {
			props: { value: ['https://a.example/cb'], onChange, clientType: 'public' }
		});
		await userEvent.click(screen.getByRole('button', { name: 'Add another URI' }));
		expect(onChange).toHaveBeenLastCalledWith(['https://a.example/cb', '']);
		expect(screen.queryByRole('button', { name: 'Remove URI 1' })).toBeNull(); // the last remaining row cannot be removed
		first.unmount();
		const { unmount } = render(RedirectUriList, {
			props: { value: Array(10).fill('https://a.example/cb'), onChange, clientType: 'public' }
		});
		expect(screen.getByRole('button', { name: 'Add another URI' })).toBeDisabled();
		unmount();
	});

	it('removing a row hands back the rest', async () => {
		const onChange = vi.fn();
		render(RedirectUriList, {
			props: {
				value: ['https://a.example/cb', 'https://b.example/cb'],
				onChange,
				clientType: 'public'
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Remove URI 1' }));
		expect(onChange).toHaveBeenLastCalledWith(['https://b.example/cb']);
	});

	it('links a per-row error to its input', () => {
		render(RedirectUriList, {
			props: {
				value: ['nope'],
				onChange: vi.fn(),
				clientType: 'public',
				errors: { 0: 'Enter a full URL.' }
			}
		});
		const input = screen.getByRole('textbox', { name: 'Redirect URI 1' });
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(
			document.getElementById(input.getAttribute('aria-describedby') as string)
		).toHaveTextContent('Enter a full URL.');
	});

	it('keeps rows keyed apart when the parent grows and shrinks the list', async () => {
		const onChange = vi.fn();
		const { rerender } = render(RedirectUriList, {
			props: { value: ['https://a.example/cb'], onChange, clientType: 'public' }
		});
		// A new row must not borrow the first row's key (each_key_duplicate would throw).
		await rerender({ value: ['https://a.example/cb', ''], onChange, clientType: 'public' });
		expect(screen.getAllByRole('textbox')).toHaveLength(2);
		const second = screen.getByRole('textbox', { name: 'Redirect URI 2' });
		await rerender({
			value: ['https://a.example/cb', 'https://c.example/cb'],
			onChange,
			clientType: 'public'
		});
		// Same DOM node after an edit: the row id is stable, so focus would survive typing.
		expect(screen.getByRole('textbox', { name: 'Redirect URI 2' })).toBe(second);
		await rerender({ value: ['https://c.example/cb'], onChange, clientType: 'public' });
		expect(screen.getAllByRole('textbox')).toHaveLength(1);
	});

	it('shows the https-only hint for confidential apps', () => {
		render(RedirectUriList, {
			props: { value: [''], onChange: vi.fn(), clientType: 'confidential' }
		});
		expect(screen.getByText('Confidential apps must use https.')).toBeInTheDocument();
	});
});
