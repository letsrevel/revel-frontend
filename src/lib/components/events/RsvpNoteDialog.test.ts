import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RsvpNoteDialog from './RsvpNoteDialog.svelte';
import { focusSettled } from '$lib/test-utils/focus';

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
		await focusSettled();
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
		const textarea = screen.getByLabelText(/note for the organizers/i);
		// Let the focus steal land, *then* take the caret back — an ad-hoc
		// double-rAF wait used to stand here, which the polled gate supersedes.
		await focusSettled();
		await user.click(textarea);
		await user.type(textarea, 'abc');
		const counter = textarea
			.closest('[role="dialog"]')
			?.querySelector('#rsvp-note-counter') as HTMLElement;
		expect(counter?.textContent).toContain('3/500');
	});

	it('disables both actions while submitting', () => {
		renderDialog({ isSubmitting: true });
		expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
	});
});
