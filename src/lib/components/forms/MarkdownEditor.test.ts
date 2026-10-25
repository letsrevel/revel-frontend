import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// $env/dynamic/public is a SvelteKit virtual module not available in jsdom.
// Mock it so the $lib/utils barrel → $lib/config/api import chain doesn't fail.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));

import MarkdownEditor from './MarkdownEditor.svelte';

describe('MarkdownEditor (contract)', () => {
	it('renders label and required indicator', () => {
		render(MarkdownEditor, { props: { label: 'Event Description', required: true, id: 'd' } });
		const label = screen.getByText('Event Description');
		expect(label.textContent).toContain('*');
	});

	it('shows error with alert role and aria wiring', () => {
		render(MarkdownEditor, { props: { label: 'Description', error: 'Required', id: 'd' } });
		expect(screen.getByRole('alert')).toHaveTextContent('Required');
	});

	it('renders a textarea fallback before enhancement (SSR/no-JS)', () => {
		render(MarkdownEditor, { props: { value: 'hello', id: 'd', label: 'L' } });
		// fallback textarea carries the value
		expect(screen.getByRole('textbox')).toHaveValue('hello');
	});

	it('fires onValueChange when value changes', async () => {
		const onValueChange = vi.fn();
		render(MarkdownEditor, { props: { value: '', id: 'd', label: 'L', onValueChange } });
		// editor mount is async; assert the callback wiring exists by simulating input on fallback
		// (full WYSIWYG editing covered by tiptap-config round-trip suite)
		const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
		ta.value = 'x';
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('x'));
	});

	it('disables editing when disabled', () => {
		render(MarkdownEditor, { props: { value: '', id: 'd', label: 'L', disabled: true } });
		expect(screen.getByRole('textbox')).toBeDisabled();
	});

	it('does not call onValueChange when value prop is updated externally', async () => {
		// The external-value-sync $effect must not trigger onValueChange for parent-driven
		// changes — only user edits should fire the callback (echo-loop guard).
		const onValueChange = vi.fn();
		const { rerender } = render(MarkdownEditor, {
			props: { value: 'initial', id: 'd', label: 'L', onValueChange }
		});

		// Let the async editor mount settle (dynamic import in onMount).
		// In jsdom there is no real Tiptap editor, so we just wait a tick.
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Clear any calls made during initial render (textarea oninput is not fired here).
		onValueChange.mockClear();

		// Update the value prop externally (simulates a parent binding change).
		await rerender({ value: 'parent-updated', id: 'd', label: 'L', onValueChange });

		// The guard should prevent onValueChange from firing for this parent-driven change.
		expect(onValueChange).not.toHaveBeenCalledWith('parent-updated');
	});
});

describe('MarkdownEditor expandable dialog', () => {
	// jsdom lacks layout APIs ProseMirror needs when focusing/scrolling the caret.
	beforeAll(() => {
		const empty = { length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] };
		const rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
		Range.prototype.getClientRects = () => empty as unknown as DOMRectList;
		Range.prototype.getBoundingClientRect = () => rect as DOMRect;
	});

	async function waitForToolbar(): Promise<void> {
		await screen.findByRole('toolbar');
	}

	it('does not render the expand button by default', async () => {
		render(MarkdownEditor, { props: { value: '', id: 'd', label: 'Description' } });
		await waitForToolbar();
		expect(screen.queryByRole('button', { name: /full-screen/i })).not.toBeInTheDocument();
	});

	it('opens a named dialog, syncs edits to the parent and closes with Done', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(MarkdownEditor, {
			props: { value: 'start', id: 'd', label: 'Description', expandable: true, onValueChange }
		});
		await waitForToolbar();
		await user.click(screen.getByRole('button', { name: /full-screen/i }));

		const dialog = await screen.findByRole('dialog', { name: 'Description' });
		expect(dialog).toBeInTheDocument();

		// Switch the dialog's editor to source mode (textarea) to type deterministically.
		const sourceBtns = await within(dialog).findAllByRole('button', { name: /markdown source/i });
		await user.click(sourceBtns[0]);
		await waitFor(() => expect(dialog.querySelector('textarea')).not.toBeNull());
		const ta = dialog.querySelector('textarea') as HTMLTextAreaElement;
		await user.clear(ta);
		await user.type(ta, 'edited in dialog');
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('edited in dialog'));

		await user.click(within(dialog).getByRole('button', { name: 'Done' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});
});
