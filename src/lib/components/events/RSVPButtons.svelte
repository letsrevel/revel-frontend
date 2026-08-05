<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check, HelpCircle, X, Lock, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		onSelect: (answer: 'yes' | 'no' | 'maybe') => void;
		currentAnswer?: 'yes' | 'no' | 'maybe' | null;
		isLoading?: boolean;
		isEligible?: boolean;
		disabled?: boolean;
		class?: string;
	}

	const {
		onSelect,
		currentAnswer = null,
		isLoading = false,
		isEligible = true,
		disabled = false,
		class: className
	}: Props = $props();

	/**
	 * Determine if a specific button is loading
	 */
	function isButtonLoading(answer: 'yes' | 'no' | 'maybe'): boolean {
		return isLoading && currentAnswer === answer;
	}

	/**
	 * Determine if a specific button is selected
	 */
	function isButtonSelected(answer: 'yes' | 'no' | 'maybe'): boolean {
		return currentAnswer === answer && !isLoading;
	}

	/**
	 * Handle button click
	 */
	function handleClick(answer: 'yes' | 'no' | 'maybe'): void {
		if (disabled || !isEligible || isLoading) {
			return;
		}

		onSelect(answer);
	}

	/**
	 * Get base button classes
	 */
	function getButtonClasses(answer: 'yes' | 'no' | 'maybe'): string {
		const selected = isButtonSelected(answer);
		const loading = isButtonLoading(answer);

		return cn(
			// Base styles
			'flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			// Mobile, Tablet, Desktop: Full width, 48px height for touch
			'xl:h-auto xl:min-w-[120px]',
			// The yes/maybe/no triad IS the semantic triad, so it now rides the
			// success / highlight / destructive tokens instead of a hand-picked
			// green/yellow/red ramp — same meaning, audited pairs, one dark mode.
			//
			// Unselected: a 10% tint that composites to ~the page colour, so the
			// label stays `text-foreground` and inherits the token contract's AA
			// guarantee. Selected: the solid token pair, which the audit script
			// enforces at >= 4.5:1 in both modes. Selection is also carried by
			// `aria-pressed` and the ring, never by fill alone.
			answer === 'yes' &&
				!selected &&
				'border-2 border-success/40 bg-success/10 text-foreground hover:border-success hover:bg-success/20',
			answer === 'yes' &&
				selected &&
				'border-2 border-success bg-success text-success-foreground ring-2 ring-success/50',
			answer === 'maybe' &&
				!selected &&
				'border-2 border-highlight/50 bg-highlight/10 text-foreground hover:border-highlight hover:bg-highlight/20',
			answer === 'maybe' &&
				selected &&
				'border-2 border-highlight bg-highlight text-highlight-foreground ring-2 ring-highlight/50',
			answer === 'no' &&
				!selected &&
				'border-2 border-destructive/40 bg-destructive/10 text-foreground hover:border-destructive hover:bg-destructive/20',
			answer === 'no' &&
				selected &&
				'border-2 border-destructive bg-destructive text-destructive-foreground ring-2 ring-destructive/50',
			// Loading state
			loading && 'cursor-wait',
			// Disabled state
			(disabled || !isEligible || (isLoading && !loading)) &&
				'cursor-not-allowed opacity-50 hover:bg-background hover:text-foreground'
		);
	}
</script>

<!--
  RSVP Buttons Component

  Presentational component for the three RSVP buttons (Yes, Maybe, No).
  Handles loading states, selected states, and disabled states.

  @component
  @example
  <RSVPButtons
    onSelect={(answer) => console.log(answer)}
    currentAnswer="yes"
    isLoading={false}
    isEligible={true}
  />
-->
<div
	role="group"
	aria-label={m['rsvp.options_label']()}
	class={cn(
		// Mobile, Tablet, and most Desktop: Vertical stack (better for touch and narrow screens)
		'flex flex-col gap-3',
		// Only on very large screens: Horizontal row (1280px+ where there's definitely enough space)
		'xl:flex-row xl:gap-4',
		className
	)}
>
	<!-- Yes Button -->
	<button
		type="button"
		onclick={() => handleClick('yes')}
		disabled={disabled || !isEligible || isLoading}
		aria-label={m['rsvp.yes_label']()}
		aria-pressed={isButtonSelected('yes')}
		class={getButtonClasses('yes')}
	>
		{#if isButtonLoading('yes')}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		{:else if !isEligible}
			<Lock class="h-5 w-5" aria-hidden="true" />
		{:else}
			<Check class="h-5 w-5" aria-hidden="true" />
		{/if}
		<span>{m['rsvp.yes_button']()}</span>
	</button>

	<!-- Maybe Button -->
	<button
		type="button"
		onclick={() => handleClick('maybe')}
		disabled={disabled || !isEligible || isLoading}
		aria-label={m['rsvp.maybe_label']()}
		aria-pressed={isButtonSelected('maybe')}
		class={getButtonClasses('maybe')}
	>
		{#if isButtonLoading('maybe')}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		{:else if !isEligible}
			<Lock class="h-5 w-5" aria-hidden="true" />
		{:else}
			<HelpCircle class="h-5 w-5" aria-hidden="true" />
		{/if}
		<span>{m['rsvp.maybe_button']()}</span>
	</button>

	<!-- No Button -->
	<button
		type="button"
		onclick={() => handleClick('no')}
		disabled={disabled || !isEligible || isLoading}
		aria-label={m['rsvp.no_label']()}
		aria-pressed={isButtonSelected('no')}
		class={getButtonClasses('no')}
	>
		{#if isButtonLoading('no')}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		{:else if !isEligible}
			<Lock class="h-5 w-5" aria-hidden="true" />
		{:else}
			<X class="h-5 w-5" aria-hidden="true" />
		{/if}
		<span>{m['rsvp.no_button']()}</span>
	</button>
</div>
