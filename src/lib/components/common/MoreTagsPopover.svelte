<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** The tags that are NOT already shown as chips. */
		tags: string[];
	}

	const { tags }: Props = $props();
</script>

<!--
	Trigger sits above the card's stretched link (z-10) with `relative z-20`, so
	a click opens the popover instead of navigating, and no <button> is nested
	inside an <a>.
-->
{#if tags.length > 0}
	<Popover.Root>
		<Popover.Trigger
			class="relative z-20 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{m['moreTags.label']({ count: tags.length })}
			<span class="sr-only">{m['moreTags.triggerSuffix']({ count: tags.length })}</span>
		</Popover.Trigger>
		<Popover.Content class="w-auto max-w-xs">
			<ul class="flex flex-wrap gap-1" aria-label={m['moreTags.listLabel']()}>
				{#each tags as tag (tag)}
					<li
						class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
					>
						{tag}
					</li>
				{/each}
			</ul>
		</Popover.Content>
	</Popover.Root>
{/if}
