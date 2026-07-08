<script lang="ts">
	// "let's revel." lockup — the official R mark + the wordmark in the brand
	// typeface (Nata Sans). Text uses currentColor so it adapts to light/dark;
	// the trailing period picks up the crimson accent (the "heart" pop).
	// Used as the header home button.
	//
	// The mark is decorative here: the visible "let's revel." text is the
	// accessible name (WCAG 2.5.3 Label in Name), so the R must not add "Revel".
	import RevelMark from './RevelMark.svelte';

	interface Props {
		class?: string;
	}
	const { class: className = '' }: Props = $props();
</script>

<span class="inline-flex items-center gap-2 {className}">
	<RevelMark decorative class="h-7 w-auto" />
	<span class="text-2xl leading-none tracking-tight">
		<span class="font-light">let’s</span>
		<span class="font-semibold">revel</span><span class="font-semibold text-accent">.</span>
	</span>
</span>
