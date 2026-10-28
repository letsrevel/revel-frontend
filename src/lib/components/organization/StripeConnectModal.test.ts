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

	it('restores focus to the opener when it closes', async () => {
		const opener = document.createElement('button');
		opener.textContent = 'Connect Stripe';
		document.body.appendChild(opener);
		opener.focus();
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const { rerender } = render(StripeConnectModal, {
			props: { show: true, initialEmail: 'a@b.co', onConfirm, onCancel }
		});
		const input = await screen.findByLabelText(/email/i, { selector: 'input' });
		await vi.waitFor(() => expect(input).toHaveFocus());
		await rerender({ show: false });
		await vi.waitFor(() => expect(opener).toHaveFocus());
		opener.remove();
	});

	it('Tab walks the dialog controls from the email field and Shift+Tab returns', async () => {
		// jsdom has no layout, so bits-ui's wrap-around trap can't be exercised here;
		// this pins the in-dialog order (email -> Cancel -> Connect) the trap cycles.
		renderIt();
		const dialog = await screen.findByRole('dialog');
		const input = await screen.findByLabelText(/email/i, { selector: 'input' });
		await vi.waitFor(() => expect(input).toHaveFocus());
		await userEvent.tab();
		expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole('button', { name: /connect/i })).toHaveFocus();
		expect(dialog.contains(document.activeElement)).toBe(true);
		await userEvent.tab({ shift: true });
		await userEvent.tab({ shift: true });
		expect(input).toHaveFocus();
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
