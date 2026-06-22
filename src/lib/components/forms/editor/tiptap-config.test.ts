// src/lib/components/forms/editor/tiptap-config.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions, isAllowedLinkScheme } from './tiptap-config';

function roundTrip(markdown: string): string {
	const el = document.createElement('div');
	const editor = new Editor({
		element: el,
		extensions: createEditorExtensions()
	});
	editor.commands.setContent(markdown, { contentType: 'markdown' });
	const out = editor.getMarkdown().trimEnd();
	editor.destroy();
	return out;
}

describe('tiptap-config round-trip', () => {
	it('preserves bold/italic/strike', () => {
		expect(roundTrip('**bold**')).toBe('**bold**');
		expect(roundTrip('*italic*')).toBe('*italic*');
		expect(roundTrip('~~struck~~')).toBe('~~struck~~');
	});

	it('preserves headings h1-h3', () => {
		expect(roundTrip('# H1')).toBe('# H1');
		expect(roundTrip('## H2')).toBe('## H2');
		expect(roundTrip('### H3')).toBe('### H3');
	});

	it('preserves lists and blockquote', () => {
		expect(roundTrip('- a\n- b')).toContain('- a');
		expect(roundTrip('1. a\n2. b')).toContain('1. a');
		expect(roundTrip('> quote')).toBe('> quote');
	});

	it('preserves inline code and code blocks', () => {
		expect(roundTrip('`code`')).toBe('`code`');
		expect(roundTrip('```\nblock\n```')).toContain('```');
	});

	it('preserves links with allowed schemes', () => {
		expect(roundTrip('[x](https://a.com)')).toBe('[x](https://a.com)');
		expect(roundTrip('[m](mailto:a@b.com)')).toBe('[m](mailto:a@b.com)');
	});

	// GATE: single-newline soft break must survive (renderer uses breaks:true)
	it('preserves a single newline as a hard break', () => {
		expect(roundTrip('line one\nline two')).toBe('line one\nline two');
	});

	it('validates link schemes', () => {
		expect(isAllowedLinkScheme('https://a.com')).toBe(true);
		expect(isAllowedLinkScheme('mailto:a@b.com')).toBe(true);
		expect(isAllowedLinkScheme('javascript:alert(1)')).toBe(false);
		expect(isAllowedLinkScheme('tel:123')).toBe(false);
	});
});
