<script lang="ts">
	// "let's revel." lockup — the R mark plus the wordmark, set exactly as the
	// Digital Brand Styleguide specifies (Revel_Digital-Styleguide.pdf pp. 3-5,
	// local-only): Nata Sans with "let's" in Light and "revel" in Semibold,
	// tracking 60 (`tracking-[0.06em]` — the wordmark is the ONE place tracking
	// is raised above 0), and, in the COLOUR lockup, "let's" AND the trailing
	// period in Ink while "revel" carries the brand gradient (Hearty Purple →
	// Light Crimson, left to right). The period is Ink, never an accent hue.
	//
	// This is the only definition of the lockup — never hand-set "let's revel."
	// at a call site. Both hand-set copies had drifted off the guide (a crimson
	// period in the footer's, an amber one in the poster's) before they were
	// folded back in here.
	//
	// Ink is `currentColor` rather than a fixed hex, so those two glyphs inherit
	// whatever foreground their surface sets — ink on light paper, near-white in
	// dark mode and on the footer's inverted band, which is also what the
	// guide's white-on-dark variant asks of them.
	//
	// `mono` is that white-on-dark variant in full: the whole lockup, mark
	// included, flat in one currentColor with the weights unchanged. Use it
	// wherever the gradient cannot read — over a brand-gradient panel above all,
	// where a purple→crimson wordmark would disappear into the panel behind it.
	//
	// Size is inherited: `class` overrides the text-2xl default through
	// tailwind-merge (and the mark is sized in `em`), so the same lockup scales
	// from the header to poster type.
	//
	// The gradient is logotype colour, exempt from WCAG 1.4.3. The mark is
	// decorative because the visible "let's revel." text is the accessible name
	// (WCAG 2.5.3 Label in Name) — the R must not announce "Revel" a second time.
	import { cn } from '$lib/utils';
	import RevelMark from './RevelMark.svelte';

	interface Props {
		class?: string;
		/** The guide's white-on-dark knockout: flat currentColor, no gradient. */
		mono?: boolean;
		/** Render the R mark beside the wordmark. */
		mark?: boolean;
	}
	const { class: className = '', mono = false, mark = true }: Props = $props();
</script>

<span
	class={cn('inline-flex items-center gap-2 text-2xl leading-none tracking-[0.06em]', className)}
>
	{#if mark}
		<RevelMark decorative gradient={!mono} class="h-[1.16em] w-auto" />
	{/if}
	<span>
		<span class="font-light">let&rsquo;s</span>
		<span
			class={mono
				? 'font-semibold'
				: 'bg-[linear-gradient(90deg,var(--logo-from),var(--logo-to))] bg-clip-text font-semibold text-transparent'}
			>revel</span
		><span class="font-semibold">.</span>
	</span>
</span>
