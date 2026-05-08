/**
 * Text processing utilities for SEO — stripping markup for plain-text descriptions.
 */

/**
 * Strip markdown formatting from a string for plain text descriptions.
 * Handles common markdown syntax: headers, bold, italic, links, lists, code blocks, etc.
 */
export function stripMarkdown(markdown: string | null | undefined): string {
	if (!markdown) return '';
	return (
		markdown
			// Remove headers (# ## ### etc.)
			.replace(/^#{1,6}\s+/gm, '')
			// Remove bold/italic markers (** __ * _)
			.replace(/(\*\*|__)(.*?)\1/g, '$2')
			.replace(/(\*|_)(.*?)\1/g, '$2')
			// Remove strikethrough (~~)
			.replace(/~~(.*?)~~/g, '$1')
			// Remove inline code (`)
			.replace(/`([^`]+)`/g, '$1')
			// Remove code blocks (```)
			.replace(/```[\s\S]*?```/g, '')
			// Remove links [text](url) -> text
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			// Remove images ![alt](url)
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
			// Remove reference-style links [text][ref]
			.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
			// Remove reference definitions [ref]: url
			.replace(/^\[[^\]]+\]:\s+.*$/gm, '')
			// Remove blockquotes (>)
			.replace(/^>\s+/gm, '')
			// Remove horizontal rules (---, ***, ___)
			.replace(/^[-*_]{3,}$/gm, '')
			// Remove unordered list markers (- * +)
			.replace(/^[\s]*[-*+]\s+/gm, '')
			// Remove ordered list markers (1. 2. etc.)
			.replace(/^[\s]*\d+\.\s+/gm, '')
			// Clean up multiple spaces and newlines
			.replace(/\s+/g, ' ')
			.trim()
	);
}
