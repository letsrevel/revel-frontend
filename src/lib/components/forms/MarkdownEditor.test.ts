import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
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
});
