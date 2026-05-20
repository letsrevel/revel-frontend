<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Sparkles } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import OfferExpiryCountdown from './OfferExpiryCountdown.svelte';

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
		const id = setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => clearInterval(id);
	});

	const remainingMs = $derived(Number.isFinite(targetMs) ? targetMs - now : -1);
	const expired = $derived(remainingMs <= 0);
	const isUrgent = $derived(!expired && remainingMs < 60 * 60 * 1000);
	const isWarning = $derived(!expired && !isUrgent && remainingMs < 24 * 60 * 60 * 1000);

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
				container:
					'border-l-4 border-red-500 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100',
				icon: 'text-red-600 dark:text-red-300 animate-pulse',
				pulse: true
			};
		}
		if (isWarning) {
			return {
				container:
					'border-l-4 border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100',
				icon: 'text-amber-600 dark:text-amber-300',
				pulse: false
			};
		}
		return {
			container:
				'border-l-4 border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100',
			icon: 'text-emerald-600 dark:text-emerald-300',
			pulse: false
		};
	});

	const livePoliteness = $derived<'assertive' | 'polite'>(isUrgent ? 'assertive' : 'polite');

	const formattedExpiry = $derived(
		Number.isFinite(targetMs)
			? new Date(targetMs).toLocaleString(undefined, {
					month: 'short',
					day: 'numeric',
					hour: 'numeric',
					minute: '2-digit'
				})
			: ''
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
				<span
					class="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-[0.7rem]"
				>
					{m['activeOffer.eyebrow']()}
				</span>
				<h2 class="text-xl font-bold leading-tight sm:text-2xl">
					{expired ? m['activeOffer.expired']() : m['activeOffer.header']()}
				</h2>
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
							isUrgent || isWarning ? 'text-lg font-semibold' : 'text-base font-medium'
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
