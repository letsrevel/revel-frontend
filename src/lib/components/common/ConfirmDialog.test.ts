import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ConfirmDialogHarness from './ConfirmDialogHarness.test.svelte';

describe('ConfirmDialog', () => {
	it('renders nothing while closed', () => {
		render(ConfirmDialogHarness, { props: { onConfirm: vi.fn(), onCancel: vi.fn() } });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('opens as a named, described modal dialog with Cancel focused', async () => {
		const user = userEvent.setup();
		render(ConfirmDialogHarness, { props: { onConfirm: vi.fn(), onCancel: vi.fn() } });
		await user.click(screen.getByRole('button', { name: 'Open' }));

		const dialog = await screen.findByRole('dialog', { name: 'Remove it?' });
		expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
		await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
	});

	it('runs onConfirm only when the confirm button is pressed', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		render(ConfirmDialogHarness, { props: { onConfirm, onCancel } });
		await user.click(screen.getByRole('button', { name: 'Open' }));
		expect(onConfirm).not.toHaveBeenCalled();

		await user.click(await screen.findByRole('button', { name: 'Remove' }));
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('cancels on the Cancel button and on Escape, never confirming', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		render(ConfirmDialogHarness, { props: { onConfirm, onCancel } });

		await user.click(screen.getByRole('button', { name: 'Open' }));
		await user.click(await screen.findByRole('button', { name: 'Cancel' }));
		expect(onCancel).toHaveBeenCalledTimes(1);

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
		await user.click(screen.getByRole('button', { name: 'Open' }));
		await screen.findByRole('dialog');
		await user.keyboard('{Escape}');
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2));
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('returns focus to the trigger after closing', async () => {
		const user = userEvent.setup();
		render(ConfirmDialogHarness, { props: { onConfirm: vi.fn(), onCancel: vi.fn() } });
		const trigger = screen.getByRole('button', { name: 'Open' });
		await user.click(trigger);
		await screen.findByRole('dialog');
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await waitFor(() => expect(trigger).toHaveFocus());
	});
});
