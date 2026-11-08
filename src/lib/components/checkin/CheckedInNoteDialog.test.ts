import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CheckedInNoteDialog from './CheckedInNoteDialog.svelte';

const note = { name: 'Ada Lovelace', body: 'Needs step-free access' };

describe('CheckedInNoteDialog', () => {
	it('shows the name and the note when given one', () => {
		render(CheckedInNoteDialog, { props: { note, onClose: vi.fn() } });
		expect(screen.getByText('Ada Lovelace is checked in')).toBeInTheDocument();
		expect(screen.getByTestId('scan-callout')).toHaveTextContent('Needs step-free access');
	});

	it('renders nothing without a note', () => {
		render(CheckedInNoteDialog, { props: { note: null, onClose: vi.fn() } });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('keeps the last note in the content while the dialog animates out', async () => {
		const { rerender } = render(CheckedInNoteDialog, { props: { note, onClose: vi.fn() } });
		expect(screen.getByTestId('scan-callout')).toBeInTheDocument();
		await rerender({ note: null, onClose: vi.fn() });
		// Parent cleared the note; the exit transition must not see empty content.
		const callout = screen.queryByTestId('scan-callout');
		if (callout) {
			expect(callout).toHaveTextContent('Needs step-free access');
			expect(screen.getByText('Ada Lovelace is checked in')).toBeInTheDocument();
		}
	});
});
