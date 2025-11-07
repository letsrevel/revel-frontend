<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	/**
	 * OrganizationDescription Component
	 *
	 * Displays an organization's description with proper HTML formatting and styling.
	 * Supports both HTML content and plain text, rendering them with Tailwind Typography
	 * for consistent, beautiful formatting.
	 *
	 * Features:
	 * - Renders description_html with proper HTML parsing
	 * - Falls back to description text if HTML not available
	 * - Applies consistent prose styling with proper spacing
	 * - Supports dark mode
	 * - Accessible with proper ARIA labels
	 * - Optionally renders in a card wrapper
	 */

	interface Props {
		/**
		 * HTML-formatted description (preferred)
		 */
		descriptionHtml?: string | null;
		/**
		 * Plain text description (fallback)
		 */
		description?: string | null;
		/**
		 * Organization name for accessibility labels
		 */
		organizationName: string;
		/**
		 * Whether to show in a card wrapper (default: true)
		 */
		showCard?: boolean;
	}

	let { descriptionHtml, description, organizationName, showCard = true }: Props = $props();

	// Determine if we have content to display
	let hasContent = $derived(
		(descriptionHtml && descriptionHtml.trim().length > 0) ||
			(description && description.trim().length > 0)
	);
</script>

{#if hasContent}
	<section aria-labelledby="description-heading">
		{#if showCard}
			<div class="rounded-lg border bg-card p-6 md:p-8">
				<h2 id="description-heading" class="sr-only">
					{m['organizationDescription.about']()}
					{organizationName}
				</h2>
				<div class="prose prose-slate dark:prose-invert max-w-none">
					{#if descriptionHtml}
						{@html descriptionHtml}
					{:else if description}
						<p>{description}</p>
					{/if}
				</div>
			</div>
		{:else}
			<h2 id="description-heading" class="sr-only">
				{m['organizationDescription.about']()}
				{organizationName}
			</h2>
			<div class="prose prose-slate dark:prose-invert max-w-none">
				{#if descriptionHtml}
					{@html descriptionHtml}
				{:else if description}
					<p>{description}</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	/* Ensure proper prose styling for description */
	:global(.prose) {
		color: inherit;
	}

	:global(.prose p) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
	}

	:global(.prose p:first-child) {
		margin-top: 0;
	}

	:global(.prose p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 600;
	}

	:global(.prose h1:first-child, .prose h2:first-child, .prose h3:first-child) {
		margin-top: 0;
	}

	:global(.prose ul, .prose ol) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
	}

	:global(.prose li) {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	:global(.prose a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: hsl(var(--primary) / 0.8);
	}

	:global(.prose strong) {
		font-weight: 600;
	}

	:global(.prose em) {
		font-style: italic;
	}

	:global(.prose code) {
		background-color: hsl(var(--muted));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
</style>
