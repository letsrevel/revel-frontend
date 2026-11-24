<script lang="ts">
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		event: EventDetailSchema;
		class?: string;
	}

	const { event, class: className }: Props = $props();
</script>

<div class={cn('space-y-6', className)}>
	<!-- Description -->
	{#if event.description}
		{#key event.description}
			<!-- The description is the page's biggest block of prose; on the
			     uplift's tinted content panel it needs its own floating card, or
			     it is the one thing left lying on the surface. -->
			<section
				aria-labelledby="description-heading"
				class="rounded-lg border-2 bg-card p-6 shadow-poster sm:p-8"
			>
				<SectionHeader
					volume="celebration"
					id="description-heading"
					title={m['eventDetails.about_heading']()}
					class="mb-4"
				/>
				<MarkdownContent content={event.description} class="max-w-[75ch]" />
			</section>
		{/key}
	{/if}

	<!-- Invitation Message (if private event) -->
	{#if event.visibility === 'private' && event.invitation_message}
		{#key event.invitation_message}
			<section
				aria-labelledby="invitation-heading"
				class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
			>
				<SectionHeader
					volume="celebration"
					id="invitation-heading"
					title={m['eventDetails.invitation_heading']()}
					class="mb-2"
				/>
				<MarkdownContent content={event.invitation_message} class="max-w-[75ch]" />
			</section>
		{/key}
	{/if}
</div>
