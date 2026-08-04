<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { AnnouncementStatus } from '$lib/api/generated/types.gen';

	interface Props {
		status: AnnouncementStatus;
	}
	const { status }: Props = $props();

	const label = $derived(
		status === 'draft'
			? m['announcements.card.draft']()
			: status === 'scheduled'
				? m['announcements.card.scheduled']()
				: m['announcements.card.sent']()
	);

	/**
	 * Domain→tone mapper (rebrand): replaces the shadcn `Badge`
	 * secondary/outline/default variant switch (which carried no semantic
	 * weight of its own) with the audited `StatusBadge` token pairs. Draft is
	 * neutral (not yet acted on), scheduled is informational (queued, not
	 * final), sent is a completed/positive state — mirrors the tone reasoning
	 * `polls/PollStatusBadge` already uses for its own draft/open/closed axis.
	 */
	const tone = $derived<Tone>(
		status === 'draft' ? 'neutral' : status === 'scheduled' ? 'info' : 'success'
	);
</script>

<StatusBadge {tone} {label} size="sm" aria-label={label} />
