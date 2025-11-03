<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Eye, EyeOff, Bold, Italic, Link as LinkIcon, List } from 'lucide-svelte';

	/**
	 * MarkdownEditor Component
	 *
	 * A textarea with markdown preview and formatting toolbar.
	 * Uses basic HTML conversion for preview (safe for common markdown).
	 *
	 * @example
	 * ```svelte
	 * <MarkdownEditor
	 *   bind:value={description}
	 *   label="Event Description"
	 *   placeholder="Describe your event..."
	 *   rows={8}
	 * />
	 * ```
	 */
	interface Props {
		/** Markdown content */
		value?: string;
		/** Unique identifier for the textarea */
		id?: string;
		/** Label text displayed above the editor */
		label?: string;
		/** Placeholder text */
		placeholder?: string;
		/** Number of textarea rows */
		rows?: number;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Error message to display */
		error?: string;
		/** Additional CSS classes */
		class?: string;
		/** Callback fired when value changes */
		onValueChange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		id,
		label,
		placeholder = 'Enter markdown content...',
		rows = 6,
		required = false,
		disabled = false,
		error,
		class: className,
		onValueChange
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `markdown-${Math.random().toString(36).substr(2, 9)}`);

	// Preview visibility state
	let showPreview = $state(false);

	// Reference to textarea for formatting operations
	let textarea = $state<HTMLTextAreaElement>();

	function handleInput(event: Event): void {
		const target = event.target as HTMLTextAreaElement;
		value = target.value;
		onValueChange?.(target.value);
	}

	/**
	 * Simple markdown to HTML converter
	 * Handles basic markdown syntax safely
	 */
	function convertMarkdownToHtml(markdown: string): string {
		if (!markdown) return `<p class="text-muted-foreground">{m['markdownEditor.nothingToPreview']()}</p>`;

		let html = markdown;

		// Escape HTML to prevent XSS
		html = html
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		// Headers
		html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

		// Bold and Italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

		// Links
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>'
		);

		// Unordered lists
		html = html.replace(/^\* (.+)$/gim, '<li class="ml-4">$1</li>');
		html = html.replace(/(<li class="ml-4">.*<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');

		// Ordered lists
		html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4">$1</li>');

		// Line breaks
		html = html.replace(/\n\n/g, '</p><p class="mb-2">');
		html = html.replace(/\n/g, '<br>');

		// Wrap in paragraph
		html = `<p class="mb-2">${html}</p>`;

		return html;
	}

	const htmlPreview = $derived(convertMarkdownToHtml(value));

	/**
	 * Insert markdown formatting at cursor position
	 */
	function insertFormatting(before: string, after: string = ''): void {
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = value.substring(start, end);
		const newText =
			value.substring(0, start) + before + selectedText + after + value.substring(end);

		value = newText;
		onValueChange?.(newText);

		// Restore cursor position
		setTimeout(() => {
			textarea?.focus();
			const newCursorPos = start + before.length + selectedText.length;
			textarea?.setSelectionRange(newCursorPos, newCursorPos);
		}, 0);
	}

	function togglePreview(): void {
		showPreview = !showPreview;
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<div class="flex items-center justify-between">
			<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				{label}
				{#if required}
					<span class="text-destructive" aria-label="required">*</span>
				{/if}
			</label>

			<button
				type="button"
				onclick={togglePreview}
				class="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-gray-900 dark:hover:text-gray-100"
				aria-label={showPreview ? 'Hide preview' : 'Show preview'}
			>
				{#if showPreview}
					<EyeOff class="h-4 w-4" aria-hidden="true" />
					<span>{m['markdownEditor.hidePreview']()}</span>
				{:else}
					<Eye class="h-4 w-4" aria-hidden="true" />
					<span>{m['markdownEditor.preview']()}</span>
				{/if}
			</button>
		</div>
	{/if}

	<!-- Formatting Toolbar -->
	{#if !showPreview && !disabled}
		<div
			class="flex flex-wrap gap-1 rounded-md border border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800"
			role="toolbar"
			aria-label="Markdown formatting toolbar"
		>
			<button
				type="button"
				onclick={() => insertFormatting('**', '**')}
				class="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
				aria-label="Bold"
				title="Bold"
			>
				<Bold class="h-4 w-4" aria-hidden="true" />
			</button>

			<button
				type="button"
				onclick={() => insertFormatting('*', '*')}
				class="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
				aria-label="Italic"
				title="Italic"
			>
				<Italic class="h-4 w-4" aria-hidden="true" />
			</button>

			<button
				type="button"
				onclick={() => insertFormatting('[](url)', '')}
				class="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
				aria-label="Insert link"
				title="Insert link"
			>
				<LinkIcon class="h-4 w-4" aria-hidden="true" />
			</button>

			<button
				type="button"
				onclick={() => insertFormatting('* ', '')}
				class="rounded p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
				aria-label="Insert list"
				title="Insert list"
			>
				<List class="h-4 w-4" aria-hidden="true" />
			</button>

			<div class="ml-auto self-center text-xs text-muted-foreground">{m['markdownEditor.markdownSupported']()}</div>
		</div>
	{/if}

	<!-- Editor / Preview -->
	{#if showPreview}
		<div
			class="prose prose-sm dark:prose-invert max-w-none rounded-md border-2 border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800"
			style="min-height: {rows * 1.5}rem"
		>
			{@html htmlPreview}
		</div>
	{:else}
		<textarea
			bind:this={textarea}
			{id}
			name={inputId}
			bind:value
			oninput={handleInput}
			{placeholder}
			{rows}
			{required}
			{disabled}
			aria-invalid={!!error}
			aria-describedby={error ? `${inputId}-error` : undefined}
			class={cn(
				'flex w-full resize-y rounded-md border-2 px-3 py-2 text-sm transition-colors',
				'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
				'placeholder:text-muted-foreground',
				'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				error
					? 'border-destructive focus:border-destructive focus:ring-destructive'
					: 'border-gray-300 dark:border-gray-600'
			)}
		></textarea>
	{/if}

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}
</div>
