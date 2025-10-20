<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { X } from 'lucide-svelte';

	/**
	 * TagInput Component
	 *
	 * Input field with autocomplete for managing tags.
	 * Supports keyboard navigation and tag removal.
	 *
	 * @example
	 * ```svelte
	 * <TagInput
	 *   bind:value={eventTags}
	 *   suggestions={['Music', 'Food', 'Sports']}
	 *   label="Event Tags"
	 *   placeholder="Add tags..."
	 * />
	 * ```
	 */
	interface Props {
		/** Array of selected tag strings */
		value?: string[];
		/** Autocomplete suggestions */
		suggestions?: string[];
		/** Unique identifier for the input */
		id?: string;
		/** Label text displayed above the input */
		label?: string;
		/** Placeholder text */
		placeholder?: string;
		/** Maximum number of tags allowed */
		maxTags?: number;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Error message to display */
		error?: string;
		/** Additional CSS classes */
		class?: string;
		/** Callback fired when tags change */
		onTagsChange?: (tags: string[]) => void;
	}

	let {
		value = $bindable([]),
		suggestions = [],
		id,
		label,
		placeholder = 'Add tag and press Enter...',
		maxTags,
		required = false,
		disabled = false,
		error,
		class: className,
		onTagsChange
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `tag-input-${Math.random().toString(36).substr(2, 9)}`);

	// Current input value
	let inputValue = $state('');

	// Show suggestions dropdown
	let showSuggestions = $state(false);

	// Filtered suggestions based on input
	let filteredSuggestions = $derived.by(() => {
		if (!inputValue || !suggestions.length) return [];

		const input = inputValue.toLowerCase().trim();
		return suggestions
			.filter((tag) => {
				const tagLower = tag.toLowerCase();
				return (
					tagLower.includes(input) &&
					!value.includes(tag) // Exclude already selected tags
				);
			})
			.slice(0, 5); // Limit to 5 suggestions
	});

	// Selected suggestion index for keyboard navigation
	let selectedSuggestionIndex = $state(-1);

	// Input reference
	let input: HTMLInputElement;

	// Check if max tags reached
	const isMaxTagsReached = $derived(maxTags ? value.length >= maxTags : false);

	// Add tag
	function addTag(tag: string): void {
		const trimmedTag = tag.trim();

		if (!trimmedTag) return;
		if (value.includes(trimmedTag)) return;
		if (isMaxTagsReached) return;

		value = [...value, trimmedTag];
		onTagsChange?.(value);
		inputValue = '';
		showSuggestions = false;
		selectedSuggestionIndex = -1;
	}

	// Remove tag
	function removeTag(index: number): void {
		value = value.filter((_, i) => i !== index);
		onTagsChange?.(value);
		input?.focus();
	}

	// Handle input
	function handleInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		inputValue = target.value;
		showSuggestions = inputValue.length > 0 && filteredSuggestions.length > 0;
		selectedSuggestionIndex = -1;
	}

	// Handle keydown
	function handleKeydown(event: KeyboardEvent): void {
		// Enter or comma: add tag
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();

			if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
				addTag(filteredSuggestions[selectedSuggestionIndex]);
			} else if (inputValue.trim()) {
				addTag(inputValue);
			}
			return;
		}

		// Backspace on empty input: remove last tag
		if (event.key === 'Backspace' && !inputValue && value.length > 0) {
			event.preventDefault();
			removeTag(value.length - 1);
			return;
		}

		// Arrow keys: navigate suggestions
		if (showSuggestions && filteredSuggestions.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				selectedSuggestionIndex = Math.min(
					selectedSuggestionIndex + 1,
					filteredSuggestions.length - 1
				);
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				showSuggestions = false;
				selectedSuggestionIndex = -1;
			}
		}
	}

	// Handle blur with delay to allow suggestion click
	function handleBlur(): void {
		setTimeout(() => {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}, 200);
	}

	// Handle suggestion click
	function selectSuggestion(tag: string): void {
		addTag(tag);
		input?.focus();
	}

	// Handle tag chip keyboard interaction
	function handleTagKeydown(event: KeyboardEvent, index: number): void {
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			removeTag(index);
		}
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{label}
			{#if required}
				<span class="text-destructive" aria-label="required">*</span>
			{/if}
			{#if maxTags}
				<span class="text-xs text-muted-foreground ml-2">
					({value.length}/{maxTags})
				</span>
			{/if}
		</label>
	{/if}

	<div class="relative">
		<!-- Tags container and input -->
		<div
			class={cn(
				'flex flex-wrap gap-2 rounded-md border-2 px-3 py-2 transition-colors',
				'bg-white dark:bg-gray-800',
				'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
				error
					? 'border-destructive focus-within:border-destructive focus-within:ring-destructive'
					: 'border-gray-300 dark:border-gray-600',
				disabled && 'cursor-not-allowed opacity-50'
			)}
		>
			<!-- Selected tags -->
			{#each value as tag, index (tag)}
				<span
					role="button"
					tabindex={disabled ? -1 : 0}
					onkeydown={(e) => handleTagKeydown(e, index)}
					class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					aria-label="Tag: {tag}, press Delete to remove"
				>
					<span>{tag}</span>
					{#if !disabled}
						<button
							type="button"
							onclick={() => removeTag(index)}
							class="rounded-full hover:bg-primary/30 p-0.5 transition-colors"
							aria-label="Remove {tag}"
						>
							<X class="h-3 w-3" aria-hidden="true" />
						</button>
					{/if}
				</span>
			{/each}

			<!-- Input field -->
			<input
				bind:this={input}
				type="text"
				{id}
				name={inputId}
				bind:value={inputValue}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onblur={handleBlur}
				onfocus={() => {
					if (inputValue && filteredSuggestions.length > 0) {
						showSuggestions = true;
					}
				}}
				{placeholder}
				{required}
				{disabled}
				readonly={isMaxTagsReached}
				aria-invalid={!!error}
				aria-describedby={error ? `${inputId}-error` : undefined}
				aria-autocomplete="list"
				aria-controls="{inputId}-suggestions"
				aria-expanded={showSuggestions}
				class={cn(
					'flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground',
					'text-gray-900 dark:text-gray-100',
					(disabled || isMaxTagsReached) && 'cursor-not-allowed'
				)}
			/>
		</div>

		<!-- Suggestions dropdown -->
		{#if showSuggestions && filteredSuggestions.length > 0}
			<ul
				id="{inputId}-suggestions"
				role="listbox"
				class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800 max-h-60 overflow-auto"
			>
				{#each filteredSuggestions as suggestion, index (suggestion)}
					<li
						role="option"
						aria-selected={index === selectedSuggestionIndex}
						onclick={() => selectSuggestion(suggestion)}
						class={cn(
							'cursor-pointer px-4 py-2 text-sm transition-colors',
							index === selectedSuggestionIndex
								? 'bg-primary text-white'
								: 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
						)}
					>
						{suggestion}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}

	{#if !error && !disabled}
		<p class="text-xs text-muted-foreground">
			Press Enter or comma to add a tag
			{#if value.length > 0}
				• Press Backspace to remove the last tag
			{/if}
		</p>
	{/if}

	<!-- Hidden input for form submission -->
	{#if value.length > 0}
		<input type="hidden" name="{inputId}-tags" value={JSON.stringify(value)} />
	{/if}
</div>
