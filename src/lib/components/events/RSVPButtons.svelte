<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check, HelpCircle, X, Lock, Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		onSelect: (answer: 'yes' | 'no' | 'maybe') => void;
		currentAnswer?: 'yes' | 'no' | 'maybe' | null;
		isLoading?: boolean;
		isEligible?: boolean;
		disabled?: boolean;
		class?: string;
	}

	let {
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
			'flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			// Mobile: Full width, 48px height for touch
			'md:h-auto md:min-w-[120px]',
			// Yes button - Green theme
			answer === 'yes' &&
				!selected &&
				'border-2 border-green-200 bg-green-50 text-green-700 hover:border-green-300 hover:bg-green-100 dark:border-green-900 dark:bg-green-950 dark:text-green-400 dark:hover:border-green-800 dark:hover:bg-green-900',
			answer === 'yes' &&
				selected &&
				'border-2 border-green-600 bg-green-600 text-white ring-2 ring-green-300 dark:border-green-500 dark:bg-green-500 dark:ring-green-400',
			// Maybe button - Yellow theme
			answer === 'maybe' &&
				!selected &&
				'border-2 border-yellow-200 bg-yellow-50 text-yellow-700 hover:border-yellow-300 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-400 dark:hover:border-yellow-800 dark:hover:bg-yellow-900',
			answer === 'maybe' &&
				selected &&
				'border-2 border-yellow-500 bg-yellow-500 text-white ring-2 ring-yellow-300 dark:border-yellow-600 dark:bg-yellow-600 dark:ring-yellow-400',
			// No button - Red theme
			answer === 'no' &&
				!selected &&
				'border-2 border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900',
			answer === 'no' &&
				selected &&
				'border-2 border-red-600 bg-red-600 text-white ring-2 ring-red-300 dark:border-red-500 dark:bg-red-500 dark:ring-red-400',
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
		// Mobile: Vertical stack
		'flex flex-col gap-3',
		// Desktop: Horizontal row
		'md:flex-row md:gap-4',
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

<style>
	/* Ensure focus indicators are always visible */
	button:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
