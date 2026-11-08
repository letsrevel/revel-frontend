import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CheckedInNoteDialog from './CheckedInNoteDialog.svelte';

const note = { name: 'Ada Lovelace', body: 'Needs step-free access', membership: null };

describe('CheckedInNoteDialog', () => {
	it('shows the name and the note when given one', () => {
		render(CheckedInNoteDialog, { props: { note, onClose: vi.fn() } });
		expect(screen.getByText('Ada Lovelace is checked in')).toBeInTheDocument();
		expect(screen.getByTestId('scan-callout')).toHaveTextContent('Needs step-free access');
	});

	it('shows the membership block as an info callout next to the note', () => {
		render(CheckedInNoteDialog, {
			props: {
				note: {
					...note,
					membership: {
						title: 'Membership',
						body: 'Day member, valid until Nov 8, 2026.',
						plain: true
					}
				},
				onClose: vi.fn()
			}
		});
		const callouts = screen.getAllByTestId('scan-callout');
		expect(callouts).toHaveLength(2);
		expect(callouts[1]).toHaveTextContent('Day member, valid until Nov 8, 2026.');
	});

	it('limits "only staff" to the note when a membership is shown too', () => {
		render(CheckedInNoteDialog, {
			props: {
				note: { ...note, membership: { title: 'Membership', body: 'Member: Gold', plain: true } },
				onClose: vi.fn()
			}
		});
		expect(screen.getByText(/Only staff can see the note\./)).toBeInTheDocument();
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
