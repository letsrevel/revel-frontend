<script lang="ts">
	import type { Component } from 'svelte';
	import type { Tone } from './tones';

	interface Props {
		tone: Tone;
		/** Already-translated label — i18n stays at the call site. */
		label: string;
		icon?: Component;
		class?: string;
	}
	const { tone, label, icon: Icon, class: className = '' }: Props = $props();

	// Solid fills only: every fg/bg pair below is a token pair enforced at
	// >= 4.5:1 by scripts/audit-brand-themes.py in BOTH modes. No alpha here —
	// that keeps this component fully covered by the audit, no hand math.
	const toneClasses: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold {toneClasses[
		tone
	]} {className}"
>
	{#if Icon}
		<Icon class="h-3 w-3" aria-hidden="true" />
	{/if}
	{label}
</span>
