<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { WaitlistOfferStatus } from '$lib/api/generated/types.gen';
	import { Ban, Check, Clock, X } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		status: WaitlistOfferStatus;
		class?: string;
	}

	const { status, class: className }: Props = $props();

	// Thin mapper over the shared StatusBadge primitive (rebrand PR 8):
	// dense waitlist admin tables, so size stays 'sm'.
	const config = $derived.by((): { label: string; icon: typeof Clock; tone: Tone } => {
		switch (status) {
			case 'pending':
				return { label: m['offerStatus.pending'](), icon: Clock, tone: 'warning' };
			case 'claimed':
				return { label: m['offerStatus.claimed'](), icon: Check, tone: 'success' };
			case 'expired':
				return { label: m['offerStatus.expired'](), icon: X, tone: 'neutral' };
			case 'revoked':
				return { label: m['offerStatus.revoked'](), icon: Ban, tone: 'danger' };
		}
	});
</script>

<!--
	aria-label is deliberate, not redundant with the visible text: this badge
	is a `common/StatusBadge` consumer (see CLAUDE.md primitive contract) and
	every domain mapper attaches its own aria-label explicitly — the primitive
	does not default it.
-->
<StatusBadge
	tone={config.tone}
	label={config.label}
	icon={config.icon}
	size="sm"
	class={className}
	aria-label={config.label}
/>
