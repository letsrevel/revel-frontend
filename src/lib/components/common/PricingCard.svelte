<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	/**
	 * The one tier/pricing card of the app.
	 *
	 * Three independent "TierCard"s used to exist — the buyer's ticket tier
	 * (`tickets/TierCard`), the organizer's tier summary (`events/admin/TierCard`)
	 * and the membership tier container (`organization/membership/TierCard`) — and
	 * they disagreed about heading weight, price size, badge shape and where the
	 * actions live. They are NOT the same component (one sells, one configures,
	 * one contains plan cards), so this is deliberately a SHELL rather than a
	 * merged component: it owns the chrome and the typography, each of the three
	 * keeps its own props, data and logic and fills the slots.
	 *
	 * Look borrowed from the landing's pricing panel: a kicker-weight tier name, a
	 * price that is genuinely big and black, and a caption doing the qualifying —
	 * hierarchy by weight and size, never by transparency.
	 *
	 * i18n stays at the call site: every string here arrives already translated.
	 */
	interface Props {
		/** Tier / plan name. */
		name: string;
		/** Heading level — match the surrounding page outline (axe heading-order). */
		level?: 2 | 3 | 4;
		/** Set on the heading so callers keep their `aria-labelledby` wiring. */
		headingId?: string;
		/** Display price: "€25.00", "Free", "€10.00 – €50.00". */
		price?: string;
		/** Qualifier under the price ("per month", "Pay what you can"). */
		priceNote?: string;
		/** Lucide icon shown before the name. Decorative. */
		icon?: Component;
		/** Chips beside the name: availability, "Free", "Default". */
		badges?: Snippet;
		/** Description / rich body. */
		children?: Snippet;
		/** Detail rows — a `<dl>`, a requirements list, nested plan cards. */
		meta?: Snippet;
		/** Buy / edit / apply controls. */
		actions?: Snippet;
		/**
		 * `split` puts the actions in a right rail from `sm` up (buyer + organizer
		 * rows); `stack` keeps them at the bottom of a full-height card (the
		 * membership grid, where cards are columns that must bottom-align).
		 */
		layout?: 'split' | 'stack';
		/** Dim the card when its tier cannot currently be acted on. */
		muted?: boolean;
		class?: string;
	}
	const {
		name,
		level = 3,
		headingId,
		price,
		priceNote,
		icon: Icon,
		badges,
		children,
		meta,
		actions,
		layout = 'split',
		muted = false,
		class: className = ''
	}: Props = $props();

	const headingClass = 'text-lg font-extrabold leading-tight';
</script>

<div
	class={cn(
		'rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-shadow sm:p-5',
		layout === 'stack' && 'flex h-full flex-col',
		muted && 'opacity-60',
		className
	)}
>
	<div
		class={cn(
			'flex flex-col gap-4',
			layout === 'stack' && 'flex-1',
			layout === 'split' && 'sm:flex-row sm:items-start sm:justify-between'
		)}
	>
		<!-- min-w-0 so a long tier name wraps instead of pushing the action rail
		     off a 390px viewport. -->
		<div class={cn('min-w-0 flex-1', layout === 'stack' && 'flex flex-1 flex-col')}>
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
				{#if Icon}
					<Icon class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
				{/if}
				{#if level === 2}
					<h2 class={headingClass} id={headingId}>{name}</h2>
				{:else if level === 3}
					<h3 class={headingClass} id={headingId}>{name}</h3>
				{:else}
					<h4 class={headingClass} id={headingId}>{name}</h4>
				{/if}
				{#if badges}
					{@render badges()}
				{/if}
			</div>

			{#if price}
				<p class="mt-1.5 text-3xl font-black leading-none tracking-tight">{price}</p>
			{/if}
			{#if priceNote}
				<p class="mt-1 text-sm font-bold text-muted-foreground">{priceNote}</p>
			{/if}

			{#if children}
				<div class="mt-2 min-w-0">{@render children()}</div>
			{/if}

			{#if meta}
				<div class={cn('mt-3 min-w-0', layout === 'stack' && 'flex-1')}>{@render meta()}</div>
			{/if}
		</div>

		{#if actions}
			<div
				class={cn(
					'flex flex-col gap-2',
					layout === 'split' && 'shrink-0 sm:items-end',
					layout === 'stack' && 'mt-auto pt-1'
				)}
			>
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
