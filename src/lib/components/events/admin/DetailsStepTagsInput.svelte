<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Hash } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { tagListTags } from '$lib/api/generated/sdk.gen';
	import { cleanTagName, hasTag, tagKey } from '$lib/utils/tags';

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
	let blurTimeout: ReturnType<typeof setTimeout> | null = null;
	let listEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	// A fresh mount has no focus, so the list must start closed. The parent
	// owns `showSuggestions`; closing the Advanced accordion unmounts us before
	// the blur timer can reset it, which left the list open on reopen.
	onMount(() => {
		showSuggestions = false;
		selectedSuggestionIndex = -1;
		return () => {
			if (searchTimeout) clearTimeout(searchTimeout);
			if (blurTimeout) clearTimeout(blurTimeout);
		};
	});

	/**
	 * The list is absolutely positioned inside whatever scrolls around it (the
	 * editor shell, the series settings dialog). Bring it into view after a
	 * search the user typed, not on every mount (refocus must not jump).
	 * `scrollIntoView` is missing in jsdom, hence the optional call.
	 */
	async function revealSuggestions(): Promise<void> {
		await tick();
		listEl?.scrollIntoView?.({ block: 'nearest' });
	}

	/**
	 * Fetch tag suggestions from API
	 */
	// Each search takes a number; Escape bumps it, so an answer to a search
	// that started before the dismissal cannot reopen the list.
	let searchSeq = 0;

	/** `reveal`: scroll the list into view (typed searches only, not refocus). */
	async function fetchTagSuggestions(search: string, reveal = false): Promise<void> {
		if (!search.trim()) {
			// Ends any search in flight: its answer is dropped and its spinner goes.
			searchSeq++;
			isLoadingSuggestions = false;
			tagSuggestions = [];
			showSuggestions = false;
			return;
		}

		const seq = ++searchSeq;
		isLoadingSuggestions = true;

		try {
			const response = await tagListTags({
				query: { search }
			});

			// Drop a late answer: the user moved on (blur, Escape, added the tag,
			// typed more). Refocus runs a new search, so a dropped answer is not lost.
			if (seq !== searchSeq || search !== tagInput || document.activeElement !== inputEl) return;

			if (response.data?.results) {
				// Extract tag names from TagSchema objects and filter out tags that are already added
				tagSuggestions = response.data.results
					.map((tag) => tag.name)
					.filter((tagName) => !hasTag(tags, tagName));
				showSuggestions = tagSuggestions.length > 0;
				selectedSuggestionIndex = -1;
				if (showSuggestions && reveal) void revealSuggestions();
			}
		} catch (error) {
			console.error('Failed to fetch tag suggestions:', error);
			// A failed older search must not close the list of a newer one.
			if (seq !== searchSeq) return;
			tagSuggestions = [];
			showSuggestions = false;
		} finally {
			// A newer search (or Escape, or an add) owns the spinner now.
			if (seq === searchSeq) isLoadingSuggestions = false;
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
			fetchTagSuggestions(value, true);
		}, 300);
	}

	/**
	 * Add tag. The name is cleaned like the backend does (no leading `#`).
	 * Text that matches a suggestion regardless of letter case takes the
	 * suggestion's casing. A duplicate (same key) is not added, but the input
	 * resets as after an add: the matching chip is already visible.
	 */
	function addTag(tag?: string): void {
		const cleaned = cleanTagName(tag ?? tagInput);
		if (!cleaned) return;
		const match = tagSuggestions.find((s) => tagKey(s) === tagKey(cleaned));
		const tagToAdd = match ?? cleaned;
		const isDuplicate = hasTag(tags, tagToAdd);

		if (searchTimeout) clearTimeout(searchTimeout);
		searchSeq++;
		isLoadingSuggestions = false;
		tagInput = '';
		tagSuggestions = [];
		showSuggestions = false;
		selectedSuggestionIndex = -1;
		if (!isDuplicate) onUpdate({ tags: [...tags, tagToAdd] });
	}

	/**
	 * Remove tag. Exact match on purpose: the chip is the stored string, and
	 * the list holds one tag per key (add refuses duplicates).
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
			searchSeq++;
			isLoadingSuggestions = false;
			if (searchTimeout) clearTimeout(searchTimeout);
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
				bind:this={inputEl}
				id="tags-input"
				type="text"
				value={tagInput}
				oninput={handleTagInput}
				onkeydown={handleTagKeydown}
				onfocus={() => {
					if (blurTimeout) clearTimeout(blurTimeout);
					// Search again: the stored list can belong to older text, or an
					// answer that arrived while the input had no focus was dropped.
					if (tagInput.trim()) void fetchTagSuggestions(tagInput);
				}}
				onblur={() => {
					// Delay hiding to allow clicking on suggestions
					if (blurTimeout) clearTimeout(blurTimeout);
					blurTimeout = setTimeout(() => {
						showSuggestions = false;
						selectedSuggestionIndex = -1;
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
					bind:this={listEl}
					id="tags-suggestions"
					role="listbox"
					class="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
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
				<div
					data-testid="tag-search-spinner"
					class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
				>
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
				<span
					class="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
				>
					<span class="min-w-0 [overflow-wrap:anywhere]">{tag}</span>
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="ml-1 shrink-0 rounded-full p-0.5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
