<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { WaitlistOfferStatus } from '$lib/api/generated/types.gen';
	import { Ban, Check, Clock, X } from 'lucide-svelte';
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
					classes:
						'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 ring-1 ring-amber-300/60 dark:ring-amber-800/60'
				};
			case 'claimed':
				return {
					label: m['offerStatus.claimed'](),
					icon: Check,
					classes:
						'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 ring-1 ring-emerald-300/60 dark:ring-emerald-800/60'
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
					classes:
						'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200 ring-1 ring-red-300/60 dark:ring-red-800/60'
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
