<script lang="ts">
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		tags: string[] | undefined;
	}

	const { tags }: Props = $props();
</script>

{#if tags && tags.length > 0}
	<section aria-labelledby="tags-heading" class="container mx-auto border-t px-6 py-8 md:px-8">
		<SectionHeader
			volume="celebration"
			id="tags-heading"
			title={m['eventDetails.tags_heading']()}
			class="mb-4"
		/>
		<!-- Tag chips: primary on the card surface with a 2px primary edge —
		     poster stickers, not washes. The card fill is opaque, so the
		     audited primary-vs-card pair governs (6.99:1 light / 6.27:1
		     dark, the same pair the questionnaire option rows rest on). -->
		<div class="flex flex-wrap gap-2">
			{#each tags as tag (tag)}
				<span
					class="rounded-full border-2 border-primary/40 bg-card px-4 py-1.5 text-sm font-extrabold text-primary shadow-poster"
				>
					{tag}
				</span>
			{/each}
		</div>
	</section>
{/if}
