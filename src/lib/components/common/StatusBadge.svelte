<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import type { Tone } from './tones';

	// RULING (#795): a badge is text, and its accessible name is its content.
	//
	// `aria-label` is deliberately OMITTED from the public type. On a role-less
	// <span> the implicit role is `generic`, which does not support name-from-
	// author, so conforming AT ignores the attribute outright (axe reports it as
	// `aria-prohibited-attr` — `incomplete` rather than a violation only because
	// there is text content to fall back on). Every name the primitive used to
	// emit was therefore reaching Playwright and nobody else.
	//
	// The `Omit` is doing the job #788's runtime default was doing. That default
	// existed because forgetting the prop in ONE mapper un-named every
	// subscription pill and took 19 e2e specs down with it (#772). A compile
	// error retires that failure class more decisively — and without the
	// prohibited attribute. Automation locates badges by `data-testid` below.
	interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
		tone: Tone;
		/** Already-translated label — i18n stays at the call site. */
		label: string;
		/**
		 * Screen-reader name for the ~7 badges whose intended announcement is
		 * genuinely richer than the visible text ("Membership status: Active",
		 * "Email is verified"). Rendered as real sr-only CONTENT, with the visible
		 * label hidden from AT so it is not read twice — the name still comes from
		 * content, it is just content the sighted reader gets from context instead.
		 *
		 * Pass the whole sentence, already translated. Do NOT compose it from a
		 * prefix plus `label`: word order and agreement differ across the six
		 * locales.
		 *
		 * Leave unset unless the visible text is genuinely ambiguous on its own —
		 * for the other ~70 badges the label IS the name and needs no help.
		 */
		srLabel?: string;
		icon?: Component;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}
	const {
		tone,
		label,
		srLabel,
		icon: Icon,
		size = 'md',
		class: className = '',
		...restProps
	}: Props = $props();

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

<!--
  `data-testid` is the automation contract that #772/#788 were really protecting,
  now labelled honestly as automation instead of dressed as accessibility. It is
  emitted by the primitive so no mapper can forget it, and sits in restProps'
  spread path so a call site can still override it.
-->
<span
	data-testid="status-badge"
	{...restProps}
	class={cn(
		'inline-flex items-center gap-1 rounded-full font-bold',
		sizeClasses[size],
		toneClasses[tone],
		className
	)}
>
	{#if srLabel}
		<span class="sr-only">{srLabel}</span>
	{/if}
	{#if Icon}
		<Icon class={iconSizes[size]} aria-hidden="true" />
	{/if}
	<span aria-hidden={srLabel ? 'true' : undefined}>{label}</span>
</span>
