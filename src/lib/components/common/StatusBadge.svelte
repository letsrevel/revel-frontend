<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import type { Tone } from './tones';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		tone: Tone;
		/** Already-translated label — i18n stays at the call site. */
		label: string;
		icon?: Component;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}
	const {
		tone,
		label,
		icon: Icon,
		size = 'md',
		class: className = '',
		...restProps
	}: Props = $props();

	// The accessible name defaults to the visible label (#788). Every mapper used
	// to have to remember to pass one; forgetting it in a single mapper un-named
	// every subscription pill and took 19 e2e specs down with it (fixed in #772).
	// Defaulting here retires that whole failure class.
	//
	// Presence-tested with `in` rather than `restProps['aria-label'] ?? label`, so
	// that passing `aria-label={undefined}` is a real OPT-OUT and not just another
	// way to spell "use the default". One call site needs that escape hatch —
	// see `account/MembershipPaymentHistory.svelte`.
	//
	// An EMPTY label emits no attribute at all. Measured against axe-core 4.12.1
	// (the version the e2e a11y smoke runs): on a role-less <span> WITH text
	// content, `aria-label` lands in `incomplete` under aria-prohibited-attr —
	// needs-review, not a violation, so the smoke stays green. On a span with NO
	// text content the same rule fires as a SERIOUS violation. `label || undefined`
	// keeps every badge on the safe side of that line.
	const ariaLabel = $derived(
		'aria-label' in restProps ? restProps['aria-label'] : label || undefined
	);

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
	const sizeClasses = {
		sm: 'px-2 py-0.5 text-[11px]',
		md: 'px-2.5 py-0.5 text-xs',
		lg: 'px-3 py-1 text-sm'
	};
	const iconSizes = { sm: 'h-3 w-3', md: 'h-3 w-3', lg: 'h-3.5 w-3.5' };
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full font-bold',
		sizeClasses[size],
		toneClasses[tone],
		className
	)}
	{...restProps}
	aria-label={ariaLabel}
>
	{#if Icon}
		<Icon class={iconSizes[size]} aria-hidden="true" />
	{/if}
	{label}
</span>
