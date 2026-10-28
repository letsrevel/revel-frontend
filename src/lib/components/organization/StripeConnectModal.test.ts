import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import StripeConnectModal from './StripeConnectModal.svelte';

function renderIt(over: Record<string, unknown> = {}) {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	render(StripeConnectModal, {
		props: { show: true, initialEmail: 'a@b.co', onConfirm, onCancel, ...over }
	});
	return { onConfirm, onCancel };
}

describe('StripeConnectModal', () => {
	it('is a labelled dialog with an accessible name and a prefilled email', async () => {
		renderIt();
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveAccessibleName();
		expect(screen.getByLabelText(/email/i, { selector: 'input' })).toHaveValue('a@b.co');
	});

	it('focuses the email input on open', async () => {
		renderIt();
		const input = await screen.findByLabelText(/email/i, { selector: 'input' });
		await vi.waitFor(() => expect(input).toHaveFocus());
	});

	it('Escape cancels', async () => {
		const { onCancel } = renderIt();
		await screen.findByRole('dialog');
		await userEvent.keyboard('{Escape}');
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('Escape is ignored while loading', async () => {
		const { onCancel } = renderIt({ isLoading: true });
		await screen.findByRole('dialog');
		await userEvent.keyboard('{Escape}');
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('confirm sends the trimmed email', async () => {
		const { onConfirm } = renderIt({ initialEmail: '  x@y.zz ' });
		await screen.findByRole('dialog');
		await userEvent.click(screen.getByRole('button', { name: /connect/i }));
		expect(onConfirm).toHaveBeenCalledWith('x@y.zz');
	});

	it('shows the error', async () => {
		renderIt({ error: 'Bad email' });
		expect(await screen.findByRole('alert')).toHaveTextContent('Bad email');
	});
});
