import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './tiptap-config';
import EditorToolbar from './EditorToolbar.svelte';
import userEvent from '@testing-library/user-event';

let editor: Editor;
beforeEach(() => {
	editor = new Editor({ element: document.createElement('div'), extensions: createEditorExtensions() });
});
afterEach(() => editor.destroy());

describe('EditorToolbar', () => {
	it('exposes a toolbar with toggle buttons', () => {
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn() } });
		expect(screen.getByRole('toolbar')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
	});

	it('toggles bold on the editor when clicked', async () => {
		const user = userEvent.setup();
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn() } });
		editor.commands.setContent('hello', { contentType: 'markdown' });
		editor.commands.selectAll();
		await user.click(screen.getByRole('button', { name: /bold/i }));
		expect(editor.isActive('bold')).toBe(true);
	});

	it('reflects active state via aria-pressed', async () => {
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn() } });
		const boldBtn = screen.getByRole('button', { name: /bold/i });
		expect(boldBtn).toHaveAttribute('aria-pressed');
	});
});
