<script lang="ts">
	import { Tag, X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { tagListTags } from '$lib/api';
	import { onMount, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { hasTag } from '$lib/utils/tags';

	interface Props {
		selectedTags: string[];
		onToggleTag: (tag: string) => void;
		class?: string;
	}

	/** Tags shown before the "Show more" toggle (the API returns them by usage). */
	const COLLAPSED_TAG_COUNT = 12;
	const uid = $props.id();
	const listId = `tags-filter-list-${uid}`;

	const { selectedTags = [], onToggleTag, class: className }: Props = $props();

	let availableTags = $state<string[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let expanded = $state(false);
	let toggleButton = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);

	// Selected tags stay visible even when they fall beyond the collapsed limit.
	// A tag that was selected stays pinned until the next show more/fewer toggle,
	// so deselecting it does not unmount the focused button (WCAG 2.4.3).
	let pinned = $state<string[]>([]);
	const visibleTags = $derived(
		expanded
			? availableTags
			: availableTags.filter(
					(tag, i) => i < COLLAPSED_TAG_COUNT || hasTag(selectedTags, tag) || hasTag(pinned, tag)
				)
	);
	const hiddenCount = $derived(availableTags.length - visibleTags.length);
	const canToggle = $derived(availableTags.length > COLLAPSED_TAG_COUNT);

	// Load tags from API on mount
	onMount(async () => {
		isLoading = true;
		error = null;

		try {
			const response = await tagListTags({
				query: {
					page: 1,
					page_size: 50 // Load first 50 tags
				}
			});

			if (response.data) {
				availableTags = response.data.results.map((tag) => tag.name);
			} else {
				error = m['filters.tags.failed']();
			}
		} catch (err) {
			console.error('Failed to load tags:', err);
			error = m['filters.tags.failed']();
			// Fallback to hardcoded tags
			availableTags = [
				'LGBTQ+',
				'Queer',
				'Sex-Positive',
				'Community',
				'Social',
				'Party',
				'Workshop',
				'Educational',
				'Networking',
				'Support Group'
			];
		} finally {
			isLoading = false;
		}
	});

	async function toggleExpanded(): Promise<void> {
		pinned = [];
		expanded = !expanded;
		await tick();
		// Collapsing can remove the toggle itself (every tag is still visible
		// because the selected ones stay shown). Move focus to the last tag button
		// so keyboard focus is not lost (WCAG 2.4.3).
		if (!toggleButton) {
			const buttons = listEl?.querySelectorAll<HTMLButtonElement>('button');
			buttons?.[buttons.length - 1]?.focus();
		}
	}

	function handleTagClick(tag: string): void {
		// Pin before toggling so a later deselect keeps the focused button mounted.
		if (!hasTag(pinned, tag)) pinned = [...pinned, tag];
		onToggleTag(tag);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Tag class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
			{m['filters.tags.heading']()}
		</h3>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-4">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
				aria-label={m['filters.tags.loading']()}
			></div>
		</div>
	{:else if error}
		<p class="text-xs text-destructive">{m['filters.tags.failed']()}</p>
	{:else if availableTags.length > 0}
		<div id={listId} bind:this={listEl} class="flex flex-wrap gap-2">
			{#each visibleTags as tag (tag)}
				{@const isSelected = hasTag(selectedTags ?? [], tag)}
				<button
					type="button"
					onclick={() => handleTagClick(tag)}
					class={cn(
						'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						isSelected
							? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
							: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
					)}
					aria-pressed={isSelected}
					aria-label={isSelected
						? m['filters.tags.remove']({ tag })
						: m['filters.tags.add']({ tag })}
				>
					{tag}
					{#if isSelected}
						<X class="h-3 w-3" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>

		{#if canToggle && (expanded || hiddenCount > 0)}
			<button
				type="button"
				bind:this={toggleButton}
				onclick={toggleExpanded}
				aria-expanded={expanded}
				aria-controls={listId}
				class="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{expanded ? m['tagsFilter.showFewer']() : m['tagsFilter.showMore']({ count: hiddenCount })}
			</button>
		{/if}

		{#if selectedTags.length > 0}
			<p class="text-xs text-muted-foreground">
				{m['filters.tags.count']({
					count: selectedTags.length,
					tagPlural: selectedTags.length === 1 ? 'tag' : 'tags'
				})}
			</p>
		{/if}
	{:else}
		<p class="text-xs text-muted-foreground">{m['filters.tags.noTags']()}</p>
	{/if}
</div>
