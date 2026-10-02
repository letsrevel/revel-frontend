import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ResolveSkippedDocumentDialog from './ResolveSkippedDocumentDialog.svelte';

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
	const onOpenChange = vi.fn();
	const returnFocus = vi.fn();
	render(ResolveSkippedDocumentDialog, {
		props: {
			open: true,
			subject: 'Invoice · E2E Business BE',
			initialReference: '',
			onSave,
			onOpenChange,
			returnFocus
		}
	});
	return { onSave, onOpenChange, returnFocus };
}

describe('ResolveSkippedDocumentDialog', () => {
	it('refuses a blank reference inline without calling the API', async () => {
		const { onSave } = setup();
		await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Enter the document number.');
		expect(screen.getByLabelText('Document number in your system')).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		expect(onSave).not.toHaveBeenCalled();
	});

	it('saves the trimmed reference and closes', async () => {
		const { onSave, onOpenChange } = setup();
		await userEvent.type(
			await screen.findByLabelText('Document number in your system'),
			'  PEPPOL-2026-0042 '
		);
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(onSave).toHaveBeenCalledWith('PEPPOL-2026-0042');
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("shows the API's refusal and stays open", async () => {
		const { onOpenChange } = setup(vi.fn().mockRejectedValue(new Error('Reference too long.')));
		await userEvent.type(await screen.findByLabelText('Document number in your system'), 'X');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Reference too long.');
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});
});
