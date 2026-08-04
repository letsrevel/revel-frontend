<script lang="ts">
	import type { Tone } from '$lib/components/common/tones';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props {
		/**
		 * `WhitelistRequestSchema.status` is a loose `string` on the wire (#782),
		 * not a narrowed enum — so this stays unlocalized and rendered verbatim
		 * (matches the pre-rebrand behaviour exactly; a copy change is out of
		 * scope here). Only the TONE is derived, with a safe fallback for any
		 * value outside the three known ones.
		 */
		status: string;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	const TONE_MAP: Record<string, Tone> = {
		pending: 'warning',
		approved: 'success',
		rejected: 'danger'
	};

	const tone = $derived(TONE_MAP[status] ?? 'warning');
</script>

<!-- aria-label mirrors the visible (unlocalized) status text, per the house
     `common/StatusBadge` mapper pattern (see `members/StatusBadge.svelte`). -->
<CommonStatusBadge {tone} label={status} size="sm" class={extraClass} aria-label={status} />
