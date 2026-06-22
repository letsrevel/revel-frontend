import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';

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
		await waitFor(() => {}, { timeout: 200 });

		// Clear any calls made during initial render (textarea oninput is not fired here).
		onValueChange.mockClear();

		// Update the value prop externally (simulates a parent binding change).
		await rerender({ value: 'parent-updated', id: 'd', label: 'L', onValueChange });

		// The guard should prevent onValueChange from firing for this parent-driven change.
		expect(onValueChange).not.toHaveBeenCalledWith('parent-updated');
	});
});
