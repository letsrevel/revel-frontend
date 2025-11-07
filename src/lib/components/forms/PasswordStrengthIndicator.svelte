<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Check, X } from 'lucide-svelte';

	interface Props {
		password: string;
		showRequirements?: boolean;
	}

	let { password, showRequirements = true }: Props = $props();

	// Check individual requirements
	let hasMinLength = $derived(password.length >= 8);
	let hasUppercase = $derived(/[A-Z]/.test(password));
	let hasLowercase = $derived(/[a-z]/.test(password));
	let hasDigit = $derived(/\d/.test(password));
	let hasSpecial = $derived(/[!@#$%^&*(),.?":{}|<>-]/.test(password));

	// Calculate strength score (0-5)
	let score = $derived(
		[hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecial].filter(Boolean).length
	);

	let widthPercentage = $derived((score / 5) * 100);

	// Color based on score
	let barColor = $derived.by(() => {
		if (score === 0) return 'bg-transparent';
		if (score <= 2) return 'bg-red-500';
		if (score === 3) return 'bg-yellow-500';
		if (score === 4) return 'bg-blue-500';
		return 'bg-green-500';
	});

	// Label based on score
	let strengthLabel = $derived.by(() => {
		if (score === 0) return 'No password';
		if (score <= 2) return 'Weak';
		if (score === 3) return 'Fair';
		if (score === 4) return 'Good';
		return 'Strong';
	});
</script>

<div class="space-y-2" role="status" aria-live="polite">
	<!-- Progress bar -->
	<div
		class="h-2 w-full overflow-hidden rounded-full bg-muted"
		role="progressbar"
		aria-valuenow={score}
		aria-valuemin={0}
		aria-valuemax={5}
		aria-label="Password strength"
	>
		<div
			class="h-full transition-all duration-300 {barColor}"
			style="width: {widthPercentage}%"
		></div>
	</div>

	<!-- Strength label -->
	{#if password.length > 0}
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted-foreground">{m['passwordStrength.strength']()}</span>
			<span class="font-medium" data-testid="strength-label">{strengthLabel}</span>
		</div>
	{/if}

	<!-- Requirements checklist -->
	{#if showRequirements && password.length > 0}
		<div class="space-y-1.5 text-xs">
			<div
				class="flex items-center gap-2 {hasMinLength
					? 'text-green-600 dark:text-green-400'
					: 'text-muted-foreground'}"
			>
				{#if hasMinLength}
					<Check class="h-3.5 w-3.5" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.atLeast8']()}</span>
			</div>

			<div
				class="flex items-center gap-2 {hasUppercase
					? 'text-green-600 dark:text-green-400'
					: 'text-muted-foreground'}"
			>
				{#if hasUppercase}
					<Check class="h-3.5 w-3.5" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneUppercase']()}</span>
			</div>

			<div
				class="flex items-center gap-2 {hasLowercase
					? 'text-green-600 dark:text-green-400'
					: 'text-muted-foreground'}"
			>
				{#if hasLowercase}
					<Check class="h-3.5 w-3.5" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneLowercase']()}</span>
			</div>

			<div
				class="flex items-center gap-2 {hasDigit
					? 'text-green-600 dark:text-green-400'
					: 'text-muted-foreground'}"
			>
				{#if hasDigit}
					<Check class="h-3.5 w-3.5" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneNumber']()}</span>
			</div>

			<div
				class="flex items-center gap-2 {hasSpecial
					? 'text-green-600 dark:text-green-400'
					: 'text-muted-foreground'}"
			>
				{#if hasSpecial}
					<Check class="h-3.5 w-3.5" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneSpecial']()}</span>
			</div>
		</div>
	{/if}
</div>
