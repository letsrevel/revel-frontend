<script lang="ts">
	import { marked } from 'marked';
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

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true, // Convert \n to <br>
		gfm: true // GitHub Flavored Markdown
	});

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
			const raw = inline ? marked.parseInline(content) : marked.parse(content);
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
		<!-- Content is sanitized by DOMPurify before rendering -->
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
