<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		status: 'active' | 'expired' | 'limit-reached' | 'staff';
		class?: string;
	}

	const { status, class: className }: Props = $props();

	/**
	 * Thin mapper over the shared `StatusBadge` primitive (rebrand). `staff`
	 * keeps its own identity as `brand` — it isn't a lifecycle state like the
	 * other three, it is a distinct token *kind* (unlimited, staff-issued) — so
	 * collapsing it onto `neutral` would erase the one distinction admins scan
	 * this pill for. `expired` and `limit-reached` stay apart too: expired is
	 * "the token itself lapsed" (`danger`, mirrors event-side
	 * `WaitlistOfferStatusBadge`'s expired state), limit-reached is "the token
	 * hit its use cap" (`warning`, still a live token, just capped).
	 */
	const TONE_MAP: Record<Props['status'], Tone> = {
		active: 'success',
		expired: 'danger',
		'limit-reached': 'warning',
		staff: 'brand'
	};

	const LABEL_MAP: Record<Props['status'], () => string> = {
		active: () => m['tokenStatusBadge.active'](),
		expired: () => m['tokenStatusBadge.expired'](),
		'limit-reached': () => m['tokenStatusBadge.limitReached'](),
		staff: () => m['tokenStatusBadge.staff']()
	};

	const tone = $derived(TONE_MAP[status]);
	const label = $derived(LABEL_MAP[status]());
</script>

<!--
	`aria-label` is explicit (the primitive also defaults one since #788), and
	every token surface (event admin card, org admin card) is located by its
	status pill through this text — dropping it here silently un-names them
	the same way it did for `members/SubscriptionStatusBadge` (see that component's test).
-->
<CommonStatusBadge {tone} {label} size="sm" class={className} aria-label={label} />
