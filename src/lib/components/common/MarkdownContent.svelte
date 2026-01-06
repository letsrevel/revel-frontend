<script lang="ts">
	import { marked } from 'marked';
	import { cn } from '$lib/utils/cn';

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

	let { content, class: className, ariaLabel, inline = false }: Props = $props();

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true, // Convert \n to <br>
		gfm: true // GitHub Flavored Markdown
	});

	/**
	 * Determine if we have valid content to display
	 */
	let hasContent = $derived(!!content && content.trim().length > 0);

	/**
	 * Parse markdown to HTML
	 */
	let renderedHtml = $derived.by(() => {
		if (!hasContent || !content) return '';
		try {
			if (inline) {
				return marked.parseInline(content);
			}
			return marked.parse(content);
		} catch {
			// If parsing fails, return the raw content escaped
			return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}
	});
</script>

{#if hasContent}
	<div
		class={cn('markdown-content prose prose-sm dark:prose-invert max-w-none', className)}
		role="region"
		aria-label={ariaLabel}
	>
		<!-- Content is sanitized markdown from backend, safe to render -->
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
