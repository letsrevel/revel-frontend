<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import OfferExpiryCountdown from './OfferExpiryCountdown.svelte';
	import { formatDateTime } from '$lib/utils/date';

	interface Props {
		expiresAt: string;
		eventName: string;
		onClaim?: () => void;
		class?: string;
	}

	const { expiresAt, eventName, onClaim, class: className }: Props = $props();

	const targetMs = $derived(Date.parse(expiresAt));
	let now = $state(Date.now());

	// Coarse tick — banner only needs to switch colour bands (24h / 1h / expired)
	// so refreshing once a minute is plenty. The nested OfferExpiryCountdown
	// drives its own faster timer for the digit display when <24h.
	$effect(() => {
		if (!Number.isFinite(targetMs)) return;
		if (Date.now() >= targetMs) return;
		const id = setInterval(() => {
			const next = Date.now();
			now = next;
			if (next >= targetMs) clearInterval(id);
		}, 60_000);
		return () => clearInterval(id);
	});

	const remainingMs = $derived(Number.isFinite(targetMs) ? targetMs - now : -1);
	const expired = $derived(remainingMs <= 0);
	const isUrgent = $derived(!expired && remainingMs < 60 * 60 * 1000);
	const isWarning = $derived(!expired && !isUrgent && remainingMs < 24 * 60 * 60 * 1000);

	/**
	 * Urgency bands on semantic tokens instead of hand-picked red/amber/emerald.
	 *
	 * The fill is a 10% tint, which composites to ~the page colour — so the body
	 * text stays `text-foreground` and inherits the token contract's own AA
	 * guarantee rather than needing a per-band foreground. The band itself is
	 * carried by the 4px rail and the icon (>= 3:1 non-text in both modes, the
	 * same tints ToneTile measures), never by the text colour, and never by
	 * colour alone: the heading and the countdown say which band this is.
	 */
	const tone = $derived.by(() => {
		if (expired) {
			return {
				container: 'border-l-4 border-muted-foreground/30 bg-muted/40 text-muted-foreground',
				icon: 'text-muted-foreground',
				pulse: false
			};
		}
		if (isUrgent) {
			return {
				container: 'border-l-4 border-destructive bg-destructive/10 text-foreground',
				icon: 'text-destructive animate-pulse',
				pulse: true
			};
		}
		if (isWarning) {
			return {
				container: 'border-l-4 border-highlight bg-highlight/10 text-foreground',
				icon: 'text-highlight-foreground dark:text-highlight',
				pulse: false
			};
		}
		return {
			container: 'border-l-4 border-success bg-success/10 text-foreground',
			icon: 'text-success',
			pulse: false
		};
	});

	const livePoliteness = $derived<'assertive' | 'polite'>(isUrgent ? 'assertive' : 'polite');

	const formattedExpiry = $derived(
		Number.isFinite(targetMs) ? formatDateTime(new Date(targetMs).toISOString()) : ''
	);

	function handleClaim() {
		if (onClaim) {
			onClaim();
			return;
		}
		if (typeof document !== 'undefined') {
			const target = document.getElementById('event-action-sidebar');
			target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

<div
	role="alert"
	aria-live={livePoliteness}
	aria-atomic="true"
	class={cn('rounded-lg p-4 sm:p-6', tone.container, className)}
	data-event-name={eventName}
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
		<div class="flex items-start gap-3 sm:items-center">
			<Sparkles class={cn('h-8 w-8 shrink-0', tone.icon)} aria-hidden="true" />
			<div class="flex flex-col gap-1">
				<span class="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">
					{m['activeOffer.eyebrow']()}
				</span>
				<!-- Not a heading: this banner can render above the event title (page
				     h1, in EventHeader), which would make a real <h2> here precede
				     the h1 in DOM order (axe heading-order, #790). The alert role +
				     aria-live on the wrapper already announces this to AT. Visual
				     classes unchanged. -->
				<p class="text-xl font-extrabold leading-tight sm:text-2xl">
					{expired ? m['activeOffer.expired']() : m['activeOffer.header']()}
				</p>
				{#if !expired}
					<p class="text-sm sm:text-base">
						{m['activeOffer.body']({ time: formattedExpiry })}
					</p>
				{/if}
			</div>
		</div>

		<div class="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
			{#if !expired}
				<div class="flex flex-col items-start sm:items-end">
					<span class="text-xs text-muted-foreground">{m['activeOffer.countdown.label']()}</span>
					<OfferExpiryCountdown
						{expiresAt}
						compact
						class={cn(
							'font-mono tabular-nums',
							isUrgent || isWarning ? 'text-lg font-extrabold' : 'text-base font-bold'
						)}
					/>
				</div>
				<Button onclick={handleClaim} class="w-full sm:w-auto">
					{m['activeOffer.cta']()}
				</Button>
			{/if}
		</div>
	</div>
</div>
