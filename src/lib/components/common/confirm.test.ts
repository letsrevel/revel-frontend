import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ConfirmHarness from './ConfirmHarness.test.svelte';

describe('createConfirm', () => {
	it('resolves true once even when Confirm is double-clicked', async () => {
		const results: boolean[] = [];
		render(ConfirmHarness, { props: { results } });
		await userEvent.setup().click(screen.getByRole('button', { name: 'Ask first' }));

		const confirm = await screen.findByRole('button', { name: 'Do it' });
		await fireEvent.click(confirm);
		await fireEvent.click(confirm);
		await fireEvent.click(confirm);

		await waitFor(() => expect(results).toEqual([true]));
	});

	it('resolves false on cancel', async () => {
		const results: boolean[] = [];
		render(ConfirmHarness, { props: { results } });
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: 'Ask first' }));
		await user.click(await screen.findByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(results).toEqual([false]));
	});

	it('settles the first ask as false when a second ask supersedes it', async () => {
		const results: boolean[] = [];
		render(ConfirmHarness, { props: { results } });
		// fireEvent: the modal makes the page behind it inert for real pointer input.
		await fireEvent.click(screen.getByRole('button', { name: 'Ask first' }));
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: 'Ask second' }));

		await waitFor(() => expect(results).toEqual([false]));
		expect(await screen.findByText('second')).toBeInTheDocument();

		await fireEvent.click(await screen.findByRole('button', { name: 'Do it' }));
		await waitFor(() => expect(results).toEqual([false, true]));
	});

	it('settles a pending ask as false when the owner unmounts', async () => {
		const results: boolean[] = [];
		const { unmount } = render(ConfirmHarness, { props: { results } });
		await fireEvent.click(screen.getByRole('button', { name: 'Ask first' }));
		await screen.findByRole('dialog');

		unmount();
		await waitFor(() => expect(results).toEqual([false]));
	});
});
