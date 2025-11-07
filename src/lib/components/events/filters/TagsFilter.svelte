<script lang="ts">
	import { Tag, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { tagListTags } from '$lib/api';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		selectedTags: string[];
		onToggleTag: (tag: string) => void;
		class?: string;
	}

	let { selectedTags = [], onToggleTag, class: className }: Props = $props();

	let availableTags = $state<string[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

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

	function handleTagClick(tag: string): void {
		onToggleTag(tag);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Tag class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">{m['filters.tags.heading']()}</h3>
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
		<div class="flex flex-wrap gap-2">
			{#each availableTags as tag (tag)}
				{@const isSelected = selectedTags?.includes(tag) ?? false}
				<button
					type="button"
					onclick={() => handleTagClick(tag)}
					class={cn(
						'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
