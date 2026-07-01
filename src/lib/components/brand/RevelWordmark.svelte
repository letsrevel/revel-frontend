<script lang="ts">
	// "let's revel." lockup — the official R mark + the wordmark set in the brand
	// typeface (Nata Sans under a brand theme). Text uses currentColor so it
	// adapts to every theme's foreground; the trailing period picks up the accent.
	// Used as the header home button. Delete with the rest of the experiment.
	import RevelMark from './RevelMark.svelte';

	interface Props {
		class?: string;
	}
	const { class: className = '' }: Props = $props();
</script>

<span class="inline-flex items-center gap-2 {className}">
	<RevelMark class="h-7 w-auto" />
	<span class="text-2xl leading-none tracking-tight">
		<span class="font-light">let’s</span>
		<span class="font-semibold">revel</span><span class="font-semibold text-accent">.</span>
	</span>
</span>
