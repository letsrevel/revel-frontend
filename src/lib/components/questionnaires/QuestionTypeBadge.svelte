<script lang="ts">
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	type QuestionType = 'multiple_choice' | 'free_text' | 'file_upload';

	interface Props {
		type: QuestionType;
		/**
		 * Already-translated label — i18n stays at the call site. Existing call
		 * sites use different strings for the same type (full names in the
		 * top-level question list vs "MC"/"FT" abbreviations in nested previews),
		 * so this mapper stays label-agnostic rather than owning the copy.
		 */
		label: string;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}
	const { type, label, size = 'sm', class: className }: Props = $props();

	/**
	 * Question-type→tone mapper (rebrand): replaces hand-picked
	 * blue-100/purple-100/green-100 pills (`QuestionnaireReadOnlyView`, the
	 * closed-poll admin question list) with the shared `StatusBadge` token set.
	 * Not a lifecycle status — a fixed type tag — but the same thin-mapper shape
	 * applies. `info` (multiple choice), `brand` (free text), `success` (file
	 * upload) keep each type visually distinct without a raw hue.
	 */
	const TONE_MAP: Record<QuestionType, Tone> = {
		multiple_choice: 'info',
		free_text: 'brand',
		file_upload: 'success'
	};
	const tone = $derived(TONE_MAP[type]);
</script>

<StatusBadge {tone} {label} {size} class={className} aria-label={label} />
