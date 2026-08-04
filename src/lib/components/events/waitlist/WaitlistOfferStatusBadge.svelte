<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { WaitlistOfferStatus } from '$lib/api/generated/types.gen';
	import { Ban, Check, Clock, X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		status: WaitlistOfferStatus;
		class?: string;
	}

	const { status, class: className }: Props = $props();

	const config = $derived.by(() => {
		switch (status) {
			case 'pending':
				return {
					label: m['offerStatus.pending'](),
					icon: Clock,
					classes: 'bg-highlight text-highlight-foreground'
				};
			case 'claimed':
				return {
					label: m['offerStatus.claimed'](),
					icon: Check,
					classes: 'bg-success text-success-foreground'
				};
			case 'expired':
				return {
					label: m['offerStatus.expired'](),
					icon: X,
					classes: 'bg-muted text-muted-foreground ring-1 ring-border'
				};
			case 'revoked':
				return {
					label: m['offerStatus.revoked'](),
					icon: Ban,
					classes: 'bg-destructive text-destructive-foreground'
				};
		}
	});
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
		config.classes,
		className
	)}
	aria-label={config.label}
>
	<config.icon class="h-3 w-3" aria-hidden="true" />
	<span>{config.label}</span>
</span>
