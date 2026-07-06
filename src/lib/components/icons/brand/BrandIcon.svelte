<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SVGAttributes } from 'svelte/elements';

	/**
	 * Base wrapper for brand/social icons that lucide removed from its icon set
	 * in v1 (trademark policy). Mirrors lucide's default SVG attributes so these
	 * render identically to the icons they replaced (24×24, stroke-based,
	 * `class` passthrough via Tailwind sizing like `h-4 w-4`).
	 */
	interface Props extends SVGAttributes<SVGSVGElement> {
		class?: string;
		children: Snippet;
	}

	let { class: className, children, ...rest }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	{...rest}
>
	{@render children()}
</svg>
