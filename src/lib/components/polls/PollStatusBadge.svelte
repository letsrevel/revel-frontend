<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { PollStatus } from '$lib/api/generated/types.gen';

	interface Props {
		status: PollStatus;
	}
	const { status }: Props = $props();

	const label = $derived(
		status === 'draft'
			? m['pollCard.status_draft']()
			: status === 'open'
				? m['pollCard.status_open']()
				: m['pollCard.status_closed']()
	);

	/**
	 * Domain→tone mapper (rebrand): the hand-picked amber-700/emerald-700 pair is
	 * gone, so both fills are now audited `StatusBadge` token pairs. Each state
	 * still carries its own word — the fill never says it alone.
	 */
	const tone = $derived<Tone>(
		status === 'draft' ? 'warning' : status === 'open' ? 'success' : 'neutral'
	);
</script>

<StatusBadge {tone} {label} size="sm" />
