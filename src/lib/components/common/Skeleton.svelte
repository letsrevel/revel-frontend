<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		variant?: 'text' | 'circular' | 'rectangular';
		width?: string;
		height?: string;
	}

	const { class: className, variant = 'rectangular', width, height }: Props = $props();

	const variantClasses = $derived(
		cn(
			'animate-pulse bg-muted',
			variant === 'text' && 'h-4 rounded',
			variant === 'circular' && 'rounded-full',
			variant === 'rectangular' && 'rounded-lg',
			className
		)
	);

	const styles = $derived.by(() => {
		const styleObj: Record<string, string> = {};
		if (width) styleObj.width = width;
		if (height) styleObj.height = height;
		return Object.entries(styleObj)
			.map(([key, value]) => `${key}: ${value}`)
			.join('; ');
	});
</script>

<div class={variantClasses} style={styles} role="status" aria-live="polite" aria-label="Loading">
	<span class="sr-only">{m['skeleton.loading']()}</span>
</div>
