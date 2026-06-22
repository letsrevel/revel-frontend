// src/lib/components/forms/editor/tiptap-config.ts
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Markdown } from '@tiptap/markdown';

export const MARKDOWN_LINK_SCHEMES = ['http', 'https', 'mailto'] as const;

export function isAllowedLinkScheme(url: string): boolean {
	const trimmed = url.trim().toLowerCase();
	return MARKDOWN_LINK_SCHEMES.some(
		(s) => trimmed.startsWith(`${s}://`) || (s === 'mailto' && trimmed.startsWith('mailto:'))
	);
}

/**
 * HardBreak override: serialize as a bare newline instead of the CommonMark
 * "two-trailing-spaces + newline" form.
 *
 * Rationale (Tiptap #7107): our renderer is configured with `marked({ breaks: true })`,
 * which treats a bare `\n` inside a paragraph as a <br>. That means both `\n` and
 * `  \n` (CommonMark hard-break) produce identical HTML. The default Tiptap serializer
 * emits `  \n`, which does NOT round-trip back to the bare `\n` that our source-of-truth
 * markdown stores. By emitting `\n` we match what the renderer expects and what was
 * originally stored.
 */
const HardBreakWithBareNewline = HardBreak.extend({
	// Override the markdown serializer to emit a bare newline.
	// This is safe because our renderer uses `breaks: true`.
	renderMarkdown: () => '\n'
});

export function createEditorExtensions(): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			// StarterKit v3 bundles HardBreak, Link + Underline.
			// Replace hardBreak with our bare-newline variant (see HardBreakWithBareNewline).
			// Drop Underline — <u> is stripped by the frontend sanitizer.
			hardBreak: false,
			underline: false,
			link: {
				openOnClick: false,
				autolink: true,
				protocols: ['http', 'https', 'mailto'],
				HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
			}
		}),
		HardBreakWithBareNewline,
		Markdown.configure({
			markedOptions: { gfm: true, breaks: true }
		})
	];
}
