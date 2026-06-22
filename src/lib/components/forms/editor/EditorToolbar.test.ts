import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './tiptap-config';
import EditorToolbar from './EditorToolbar.svelte';
import userEvent from '@testing-library/user-event';

let editor: Editor;
beforeEach(() => {
	editor = new Editor({
		element: document.createElement('div'),
		extensions: createEditorExtensions()
	});
});
afterEach(() => editor.destroy());

describe('EditorToolbar', () => {
	it('exposes a toolbar with toggle buttons', () => {
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn(), onInsertLink: vi.fn() } });
		expect(screen.getByRole('toolbar')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
	});

	it('toggles bold on the editor when clicked', async () => {
		const user = userEvent.setup();
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn(), onInsertLink: vi.fn() } });
		editor.commands.setContent('hello', { contentType: 'markdown' });
		editor.commands.selectAll();
		await user.click(screen.getByRole('button', { name: /bold/i }));
		expect(editor.isActive('bold')).toBe(true);
	});

	it('reflects active state via aria-pressed', async () => {
		render(EditorToolbar, { props: { editor, onToggleSource: vi.fn(), onInsertLink: vi.fn() } });
		const boldBtn = screen.getByRole('button', { name: /bold/i });
		expect(boldBtn).toHaveAttribute('aria-pressed');
	});

	it('moves focus with ArrowRight and wraps around with ArrowLeft', async () => {
		const user = userEvent.setup();
		render(EditorToolbar, {
			props: { editor, onToggleSource: vi.fn(), onInsertLink: vi.fn() }
		});

		const toolbar = screen.getByRole('toolbar');
		const buttons = Array.from(toolbar.querySelectorAll('button')) as HTMLButtonElement[];
		expect(buttons.length).toBeGreaterThan(1);

		// Focus the first button.
		buttons[0].focus();
		expect(document.activeElement).toBe(buttons[0]);

		// ArrowRight → move to second button.
		await user.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(buttons[1]);

		// ArrowLeft → move back to first button.
		await user.keyboard('{ArrowLeft}');
		expect(document.activeElement).toBe(buttons[0]);

		// Home → stay at first button.
		await user.keyboard('{Home}');
		expect(document.activeElement).toBe(buttons[0]);

		// End → jump to last button.
		await user.keyboard('{End}');
		expect(document.activeElement).toBe(buttons[buttons.length - 1]);
	});
});
