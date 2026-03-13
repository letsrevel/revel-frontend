<script lang="ts">
	import { Hash } from 'lucide-svelte';
	import {
		organizationadminmembersAddTags,
		organizationadminmembersRemoveTags,
		tagListTags
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		slug: string;
		accessToken: string | null;
		initialTags: string[];
		onRegisterSave?: (saveFn: () => Promise<void>) => void;
	}

	let { slug, accessToken, initialTags: initialTagsProp, onRegisterSave }: Props = $props();

	let tags = $state<string[]>([...initialTagsProp]);
	let savedTags = $state<string[]>([...initialTagsProp]);
	let tagInput = $state('');
	let tagSuggestions = $state<string[]>([]);
	let showTagSuggestions = $state(false);
	let isLoadingTagSuggestions = $state(false);
	let tagSearchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Sync when parent data changes (after form submission)
	$effect(() => {
		tags = [...initialTagsProp];
		savedTags = [...initialTagsProp];
	});

	/**
	 * Fetch tag suggestions from API
	 */
	async function fetchTagSuggestions(search: string): Promise<void> {
		if (!search.trim()) {
			tagSuggestions = [];
			showTagSuggestions = false;
			return;
		}

		isLoadingTagSuggestions = true;

		try {
			const response = await tagListTags({
				query: { search: search.trim() }
			});

			if (response.data?.results) {
				tagSuggestions = response.data.results
					.map((tag) => tag.name)
					.filter((tagName) => !tags.includes(tagName));
				showTagSuggestions = tagSuggestions.length > 0;
			}
		} catch (error) {
			console.error('Failed to fetch tag suggestions:', error);
			tagSuggestions = [];
		} finally {
			isLoadingTagSuggestions = false;
		}
	}

	/**
	 * Handle tag input changes (with debouncing)
	 */
	function handleTagInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const value = target.value;
		tagInput = value;

		if (tagSearchTimeout) {
			clearTimeout(tagSearchTimeout);
		}

		tagSearchTimeout = setTimeout(() => {
			fetchTagSuggestions(value);
		}, 300);
	}

	/**
	 * Add tag
	 */
	function addTag(tag?: string): void {
		const tagToAdd = tag || tagInput.trim();
		if (tagToAdd && !tags.includes(tagToAdd)) {
			tags = [...tags, tagToAdd];
			tagInput = '';
			tagSuggestions = [];
			showTagSuggestions = false;
		}
	}

	/**
	 * Remove tag
	 */
	function removeTag(tag: string): void {
		tags = tags.filter((t) => t !== tag);
	}

	/**
	 * Save tag associations (add/remove tags).
	 * Called by the parent form on submission via registered callback.
	 */
	async function saveTagAssociations(): Promise<void> {
		if (!accessToken) return;

		const addedTags = tags.filter((tag) => !savedTags.includes(tag));
		const removedTags = savedTags.filter((tag) => !tags.includes(tag));

		if (addedTags.length > 0) {
			await organizationadminmembersAddTags({
				path: { slug },
				body: { tags: addedTags },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
		}

		if (removedTags.length > 0) {
			await organizationadminmembersRemoveTags({
				path: { slug },
				body: { tags: removedTags },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
		}

		savedTags = [...tags];
	}

	// Register the save function with the parent
	$effect(() => {
		onRegisterSave?.(saveTagAssociations);
	});
</script>

<div class="space-y-2">
	<label for="tags-input" class="block text-sm font-medium">
		<span class="flex items-center gap-2">
			<Hash class="h-4 w-4" aria-hidden="true" />
			Tags
		</span>
	</label>
	<div class="flex gap-2">
		<div class="relative flex-1">
			<input
				id="tags-input"
				type="text"
				value={tagInput}
				oninput={handleTagInput}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						addTag();
					}
				}}
				onfocus={() => {
					if (tagInput.trim() && tagSuggestions.length > 0) {
						showTagSuggestions = true;
					}
				}}
				onblur={() => {
					setTimeout(() => {
						showTagSuggestions = false;
					}, 200);
				}}
				placeholder="Add tags..."
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				autocomplete="off"
			/>

			{#if showTagSuggestions && tagSuggestions.length > 0}
				<div
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
				>
					{#each tagSuggestions as suggestion}
						<button
							type="button"
							onclick={() => addTag(suggestion)}
							class="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							<Hash class="mr-2 h-3 w-3" aria-hidden="true" />
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}

			{#if isLoadingTagSuggestions}
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
			Add
		</button>
	</div>
	{#if tags.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each tags as tag}
				<span class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
					{tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="ml-1 rounded-full p-0.5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Remove {tag} tag"
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
