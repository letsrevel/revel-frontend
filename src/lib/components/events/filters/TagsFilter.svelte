<script lang="ts">
	import { Tag, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		selectedTags: string[];
		onToggleTag: (tag: string) => void;
		class?: string;
	}

	let { selectedTags = [], onToggleTag, class: className }: Props = $props();

	// Popular tags (this could be fetched from the API in the future)
	const popularTags = [
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

	function handleTagClick(tag: string): void {
		onToggleTag(tag);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Tag class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Tags</h3>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each popularTags as tag (tag)}
			{@const isSelected = selectedTags.includes(tag)}
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
			{selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'} selected
		</p>
	{/if}
</div>
