<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		isActive: boolean;
		class?: string;
	}

	const { isActive, class: extraClass = '' }: Props = $props();

	const tone: Tone = $derived(isActive ? 'success' : 'neutral');
	const label = $derived(
		isActive ? m['discountCodesAdmin.status.active']() : m['discountCodesAdmin.status.inactive']()
	);
</script>

<!-- House `common/StatusBadge` mapper pattern (see
     `members/SubscriptionStatusBadge.svelte`). -->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} />
