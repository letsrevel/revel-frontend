<script lang="ts">
	/**
	 * The editor's copy of the seat-back orientation notch: the SAME geometry
	 * the buyer's seat map draws inside each seat circle (`seat-rotation.ts` is
	 * the single source — see its contract note), wrapped in its own tiny <svg>
	 * because a grid cell is an HTML <button>, not an SVG node.
	 *
	 * `stroke-current` inherits the button's text color, so the notch keeps the
	 * exact contrast the seat's own label already has — including on a painted
	 * seat, whose foreground is set inline from `paintTextColor`.
	 *
	 * Purely decorative: rotation is inspected and edited in the adjust-mode
	 * inspector, which is the accessible surface for it.
	 */
	import { notchSegment } from '$lib/components/tickets/seat-rotation';

	interface Props {
		/** Degrees clockwise from "up". 0 (or absent) draws nothing. */
		rot: number;
		/** Cell button size in px; the seat's radius is half of it. */
		size: number;
	}

	const { rot, size }: Props = $props();

	const radius = $derived(size / 2);
	const notch = $derived(notchSegment(rot, radius));
</script>

{#if rot !== 0}
	<svg
		class="pointer-events-none absolute inset-0"
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		aria-hidden="true"
		data-testid="seat-rotation-notch"
		data-rot={rot}
	>
		<line
			x1={radius + notch.x1}
			y1={radius + notch.y1}
			x2={radius + notch.x2}
			y2={radius + notch.y2}
			class="stroke-current"
			stroke-width={notch.width}
			stroke-linecap="round"
		/>
	</svg>
{/if}
