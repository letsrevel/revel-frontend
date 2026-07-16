import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RsvpNoteDialog from './RsvpNoteDialog.svelte';

function renderDialog(props: Partial<Record<string, unknown>> = {}) {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	const result = render(RsvpNoteDialog, {
		props: {
			open: true,
			answer: 'yes',
			initialNote: '',
			isSubmitting: false,
			onConfirm,
			onCancel,
			...props
		}
	});
	return { ...result, onConfirm, onCancel };
}

describe('RsvpNoteDialog', () => {
	it('prefills the textarea with the stored note', () => {
		renderDialog({ initialNote: 'gluten-free please' });
		expect(screen.getByLabelText(/note for the organizers/i)).toHaveValue('gluten-free please');
	});

	it('passes the edited note to onConfirm', async () => {
		const user = userEvent.setup();
		const { onConfirm } = renderDialog();
		await user.type(screen.getByLabelText(/note for the organizers/i), 'two of us');
		await user.click(screen.getByRole('button', { name: /^RSVP Yes$/i }));
		expect(onConfirm).toHaveBeenCalledWith('two of us');
	});

	it('resubmits the stored note unchanged when the user does not edit it', async () => {
		const user = userEvent.setup();
		const { onConfirm } = renderDialog({ initialNote: 'keep me' });
		await user.click(screen.getByRole('button', { name: /^RSVP Yes$/i }));
		expect(onConfirm).toHaveBeenCalledWith('keep me');
	});

	it('fires onCancel and never onConfirm when cancelled', async () => {
		const user = userEvent.setup();
		const { onConfirm, onCancel } = renderDialog();
		await user.click(screen.getByRole('button', { name: /^cancel$/i }));
		expect(onCancel).toHaveBeenCalled();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('labels the confirm button with the chosen answer', () => {
		renderDialog({ answer: 'maybe' });
		expect(screen.getByRole('button', { name: /^RSVP Maybe$/i })).toBeInTheDocument();
	});

	it('shows a live character counter', async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.type(screen.getByLabelText(/note for the organizers/i), 'abc');
		expect(screen.getByText('3/500')).toBeInTheDocument();
	});

	it('disables both actions while submitting', () => {
		renderDialog({ isSubmitting: true });
		expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
	});
});
