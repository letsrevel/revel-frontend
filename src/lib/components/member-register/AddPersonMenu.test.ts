import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AddPersonMenu from './AddPersonMenu.svelte';

describe('AddPersonMenu', () => {
	it('"Add by account" calls its callback', async () => {
		const onAddByAccount = vi.fn();
		render(AddPersonMenu, {
			props: { onAddToRegister: vi.fn(), onAddByAccount, onCreateInviteLink: vi.fn() }
		});
		screen.getByTestId('add-person').focus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() => expect(screen.getByTestId('add-by-account')).toBeInTheDocument());
		expect(screen.getByTestId('add-by-account')).toHaveTextContent('Add by account');
		await userEvent.click(screen.getByTestId('add-by-account'));
		expect(onAddByAccount).toHaveBeenCalledTimes(1);
		document.body.style.pointerEvents = '';
	});
});
