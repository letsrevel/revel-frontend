<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Hash } from '@lucide/svelte';
	import { tagListTags } from '$lib/api/generated/sdk.gen';

	interface Props {
		tags: string[];
		/** Draft state is owned by DetailsStep (bound in) so a half-typed tag
		 *  draft survives collapsing/reopening the Advanced accordion, which
		 *  unmounts this component — matching the pre-split behavior where
		 *  these four fields were top-level DetailsStep $state. */
		tagInput: string;
		tagSuggestions: string[];
		showSuggestions: boolean;
		selectedSuggestionIndex: number;
		onUpdate: (data: { tags: string[] }) => void;
	}

	let {
		tags,
		tagInput = $bindable(),
		tagSuggestions = $bindable(),
		showSuggestions = $bindable(),
		selectedSuggestionIndex = $bindable(),
		onUpdate
	}: Props = $props();

	// Transient fetch state (spinner + debounce handle) stays local
	let isLoadingSuggestions = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Fetch tag suggestions from API
	 */
	async function fetchTagSuggestions(search: string): Promise<void> {
		if (!search.trim()) {
			tagSuggestions = [];
			showSuggestions = false;
			return;
		}

		isLoadingSuggestions = true;

		try {
			const response = await tagListTags({
				query: { search }
			});

			if (response.data?.results) {
				// Extract tag names from TagSchema objects and filter out tags that are already added
				tagSuggestions = response.data.results
					.map((tag) => tag.name)
					.filter((tagName) => !tags.includes(tagName));
				showSuggestions = tagSuggestions.length > 0;
				selectedSuggestionIndex = -1;
			}
		} catch (error) {
			console.error('Failed to fetch tag suggestions:', error);
			tagSuggestions = [];
			showSuggestions = false;
		} finally {
			isLoadingSuggestions = false;
		}
	}

	/**
	 * Handle tag input changes (with debouncing)
	 */
	function handleTagInput(e: Event): void {
		const value = (e.target as HTMLInputElement).value;
		tagInput = value;

		// Clear previous timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		// Debounce search by 300ms
		searchTimeout = setTimeout(() => {
			fetchTagSuggestions(value);
		}, 300);
	}

	/**
	 * Add tag
	 */
	function addTag(tag?: string): void {
		const tagToAdd = tag || tagInput.trim();
		if (tagToAdd && !tags.includes(tagToAdd)) {
			onUpdate({ tags: [...tags, tagToAdd] });
			tagInput = '';
			tagSuggestions = [];
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}
	}

	/**
	 * Remove tag
	 */
	function removeTag(tag: string): void {
		onUpdate({ tags: tags.filter((t) => t !== tag) });
	}

	/**
	 * Handle tag input keydown
	 */
	function handleTagKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (selectedSuggestionIndex >= 0 && tagSuggestions[selectedSuggestionIndex]) {
				addTag(tagSuggestions[selectedSuggestionIndex]);
			} else {
				addTag();
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (showSuggestions && tagSuggestions.length > 0) {
				selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, tagSuggestions.length - 1);
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (showSuggestions && tagSuggestions.length > 0) {
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			}
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}
	}

	/**
	 * Select a suggestion
	 */
	function selectSuggestion(tag: string): void {
		addTag(tag);
	}
</script>

<!-- Tags -->
<div class="relative space-y-2">
	<label for="tags-input" class="block text-sm font-medium">
		<span class="flex items-center gap-2">
			<Hash class="h-4 w-4" aria-hidden="true" />
			{m['detailsStep.tags']()}
		</span>
	</label>
	<div class="flex gap-2">
		<div class="relative flex-1">
			<input
				id="tags-input"
				type="text"
				value={tagInput}
				oninput={handleTagInput}
				onkeydown={handleTagKeydown}
				onfocus={() => {
					if (tagInput.trim() && tagSuggestions.length > 0) {
						showSuggestions = true;
					}
				}}
				onblur={() => {
					// Delay hiding to allow clicking on suggestions
					setTimeout(() => {
						showSuggestions = false;
					}, 200);
				}}
				placeholder={m['detailsStep.addTagsPlaceholder']()}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				autocomplete="off"
				role="combobox"
				aria-expanded={showSuggestions}
				aria-controls="tags-suggestions"
				aria-activedescendant={selectedSuggestionIndex >= 0
					? `tag-suggestion-${selectedSuggestionIndex}`
					: undefined}
			/>

			{#if showSuggestions && tagSuggestions.length > 0}
				<div
					id="tags-suggestions"
					role="listbox"
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
				>
					{#each tagSuggestions as suggestion, index (suggestion)}
						<button
							type="button"
							id="tag-suggestion-{index}"
							role="option"
							aria-selected={selectedSuggestionIndex === index}
							onclick={() => selectSuggestion(suggestion)}
							class="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground {selectedSuggestionIndex ===
							index
								? 'bg-accent text-accent-foreground'
								: ''}"
						>
							<Hash class="mr-2 h-3 w-3" aria-hidden="true" />
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}

			{#if isLoadingSuggestions}
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
					<svg
						class="h-4 w-4 animate-spin text-muted-foreground"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
				</div>
			{/if}
		</div>
		<button
			type="button"
			onclick={() => addTag()}
			class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{m['detailsStep.add']()}
		</button>
	</div>
	{#if tags && tags.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each tags as tag (tag)}
				<span class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
					{tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="ml-1 rounded-full p-0.5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={m['detailsStep.removeTag']({ tag })}
					>
						<svg
							class="h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>
