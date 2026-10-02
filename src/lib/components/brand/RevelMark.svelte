<script lang="ts">
	// Revel "R" mark — the designer's official vector (brand/01_Revel_Logo/
	// Revel_Logo/Revel_Logo.svg, 2026-10), viewBox cropped to the mark's own
	// bounds within the 2000×2000 artboard. The heart is a reverse-wound subpath
	// (a real hole in the R body), so it shows whatever is behind it. Fill the body with the
	// brand gradient (default, via --logo-from/--logo-to) or flat currentColor.
	interface Props {
		/** Purple→crimson brand gradient (default) or flat currentColor fill. */
		gradient?: boolean;
		class?: string;
		title?: string;
		/** Decorative: hide from assistive tech (use when adjacent text names it). */
		decorative?: boolean;
	}
	const {
		gradient = true,
		class: className = '',
		title = 'Revel',
		decorative = false
	}: Props = $props();

	// Stable, SSR-safe unique id (no Math.random → no hydration mismatch).
	const uid = $props.id();
</script>

<svg
	viewBox="518 448 964 1104"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	role={decorative ? undefined : 'img'}
	aria-label={decorative ? undefined : title}
	aria-hidden={decorative ? 'true' : undefined}
>
	{#if gradient}
		<defs>
			<linearGradient id={`revel-${uid}`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--logo-from, hsl(270 70% 55%))" />
				<stop offset="100%" stop-color="var(--logo-to, hsl(3 79% 53%))" />
			</linearGradient>
		</defs>
	{/if}
	<path
		fill={gradient ? `url(#revel-${uid})` : 'currentColor'}
		d="M1478.33,1279.67c-12.63-86.17-61.03-167.86-113.34-235.62v-1.72c5.99-4.12,13.65-10.59,18.94-15.96,104.8-106.34,130.42-282.68,43.51-407.91-89.29-128.67-264.9-163.13-411.99-168.79-135.71-5.22-296.99,3.58-393.92,111.19-104,115.47-88.53,257.18-93.97,401.65-4.98,132.17-26.58,313.8,24.24,436.99,51.01,123.68,194.79,194.37,315.81,117.17,92.45-58.98,114.64-172.23,105.83-275.04-2.75-32.05-7.69-63.81-14.42-95.18,17.33,9.51,47.39,17.7,90.18.19-8.47,84.8-5.07,206.06,22.7,272.14,27.28,64.93,115.51,127.73,185.97,132.22,152.23,9.7,240.98-131.21,220.46-271.33ZM1046,964.64c-37.7,31.83-72.22,31.79-109.24-2.16-61.5-56.39-116.52-215.16-84.54-293.94,20-49.26,88.33-53.89,111.99-5.57,18.13,37.04,34.79,111.03,34.79,111.03,11.57-40.35,18.17-116.78,59.17-137.27,45.78-22.89,83.72,5.48,90.19,52.64,11.21,81.79-38.94,221.74-102.36,275.27Z"
	/>
</svg>
