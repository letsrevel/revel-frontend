<script lang="ts">
	import { Clock, Check, X } from '@lucide/svelte';
	import type { Tone } from '$lib/components/common/tones';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props {
		/**
		 * `WhitelistRequestSchema.status` is a loose `string` on the wire (#782),
		 * not a narrowed enum — so this stays unlocalized and rendered verbatim
		 * (matches the pre-rebrand behaviour exactly; a copy change is out of
		 * scope here). Only the TONE and ICON are derived, both with a safe
		 * fallback (pending's) for any value outside the three known ones —
		 * mirrors the pre-rebrand `statusStyles[...] || statusStyles.pending`.
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

	// Restores the per-status icon the pre-rebrand pill carried (its sibling,
	// `WhitelistRequestCard`'s own action buttons, still use the same
	// Clock/Check/X set) — dropped when this became a `common/StatusBadge`
	// mapper, since the primitive's `icon` prop is opt-in.
	const ICON_MAP: Record<string, typeof Clock> = {
		pending: Clock,
		approved: Check,
		rejected: X
	};

	const tone = $derived(TONE_MAP[status] ?? 'warning');
	const icon = $derived(ICON_MAP[status] ?? Clock);
</script>

<!-- House `common/StatusBadge` mapper pattern (see
     `members/SubscriptionStatusBadge.svelte`); the raw (unlocalized) status text
     is both the visible label and the accessible name (#795). -->
<CommonStatusBadge {tone} label={status} {icon} size="sm" class={extraClass} />
