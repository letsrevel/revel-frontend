<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from '@lucide/svelte';

	interface Props {
		onGo: () => void;
	}

	const { onGo }: Props = $props();
</script>

<!-- Studio volume: a plain card nudging ticketed events on to tier setup -->
<section
	class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
	aria-labelledby="editor-next-step"
>
	<p id="editor-next-step" class="text-sm font-semibold">
		{m['eventEditor.nextStepTicketing']()}
	</p>
	<Button variant="outline" class="border-primary text-primary" onclick={onGo}>
		{m['eventEditor.goToTicketing']()}
		<ArrowRight class="ml-2 h-4 w-4" aria-hidden="true" />
	</Button>
</section>
