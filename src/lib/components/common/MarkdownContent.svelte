<script lang="ts" module>
	import { Marked } from 'marked';

	// Scoped parser instance (not the global `marked` singleton) so the
	// heading demotion below can't leak into other markdown consumers.
	const markdownParser = new Marked({
		breaks: true, // Convert \n to <br>
		gfm: true, // GitHub Flavored Markdown
		// Demote headings one level (h1→h2, …, capped at h6): the page itself
		// owns the single <h1>, so user-authored "# Heading" markdown must not
		// introduce additional h1s (WCAG heading structure, #596).
		walkTokens: (token) => {
			if (token.type === 'heading') {
				token.depth = Math.min(token.depth + 1, 6);
			}
		}
	});
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	/**
	 * Props interface for MarkdownContent component
	 * Renders sanitized markdown content from the backend as HTML
	 */
	interface Props {
		/**
		 * Markdown content to render (sanitized by backend)
		 */
		content: string | null | undefined;
		/**
		 * Optional CSS classes to customize styling
		 */
		class?: string;
		/**
		 * ARIA label for the content region (for screen readers)
		 */
		ariaLabel?: string;
		/**
		 * Whether to render inline (no block elements like <p>)
		 */
		inline?: boolean;
	}

	const { content, class: className, ariaLabel, inline = false }: Props = $props();

	/**
	 * Determine if we have valid content to display
	 */
	const hasContent = $derived(!!content && content.trim().length > 0);

	/**
	 * Parse markdown to HTML
	 */
	const renderedHtml = $derived.by(() => {
		if (!hasContent || !content) return '';
		try {
			const raw = inline ? markdownParser.parseInline(content) : markdownParser.parse(content);
			return sanitizeHtml(typeof raw === 'string' ? raw : String(raw));
		} catch {
			// If parsing fails, return the raw content escaped
			return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}
	});
</script>

{#if hasContent}
	<div
		class={cn('markdown-content prose prose-sm max-w-none dark:prose-invert', className)}
		role="region"
		aria-label={ariaLabel}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- content is sanitized via sanitizeHtml (DOMPurify allowlist) before rendering -->
		{@html renderedHtml}
	</div>
{/if}

<style>
	/* Make links clearly visible and distinct from regular text */
	.markdown-content :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
		text-underline-offset: 3px;
		font-weight: 500;
	}

	.markdown-content :global(a:hover) {
		opacity: 0.8;
	}
</style>
