<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Check, X } from '@lucide/svelte';

	interface Props {
		password: string;
		showRequirements?: boolean;
		/** Bindable prop to expose whether password meets all requirements */
		isValid?: boolean;
	}

	// `isValid` is a $bindable prop kept in sync via the $effect below; `false` is the real
	// initial value observed by any consumer that binds it before the first effect flush.
	// Dropping the default (-> undefined) would change that public initial-value contract,
	// so this is intentionally not "dead".
	// eslint-disable-next-line no-useless-assignment
	let { password, showRequirements = true, isValid = $bindable(false) }: Props = $props();

	// Check individual requirements
	const hasMinLength = $derived(password.length >= 8);
	const hasUppercase = $derived(/[A-Z]/.test(password));
	const hasLowercase = $derived(/[a-z]/.test(password));
	const hasDigit = $derived(/\d/.test(password));
	const hasSpecial = $derived(/[!@#$%^&*(),.?":{}|<>\-[\]=]/.test(password));

	// Calculate strength score (0-5)
	const score = $derived(
		[hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecial].filter(Boolean).length
	);

	const widthPercentage = $derived((score / 5) * 100);

	// Color based on score. Tokens only (raw-hue sweep): success/info/highlight/
	// destructive already carry their own dark-mode values, so no `dark:`
	// override is needed here (unlike the raw Tailwind hues this replaces).
	const barColor = $derived.by(() => {
		if (score === 0) return 'bg-transparent';
		if (score <= 2) return 'bg-destructive';
		if (score === 3) return 'bg-highlight';
		if (score === 4) return 'bg-info';
		return 'bg-success';
	});

	// Label based on score - only show positive labels when ALL requirements are met
	const strengthLabel = $derived.by(() => {
		if (score === 0) return m['passwordStrength.noPassword']();
		if (score <= 2) return m['passwordStrength.weak']();
		if (score === 3) return m['passwordStrength.fair']();
		if (score === 4) return m['passwordStrength.almostThere']();
		return m['passwordStrength.strong']();
	});

	// Label color based on whether all requirements are met. `highlight` (amber)
	// text needs the same light/dark swap ToneTile uses for its warning tone
	// (amber-on-light fails at 1.8:1, so light mode falls back to
	// highlight-foreground; dark mode uses highlight directly) — see
	// ToneTile.svelte's verified-ratio comment for the underlying numbers.
	// `destructive` as plain text (not a solid fill) is fine in light mode
	// (8.63:1 on background) but the dark token is only ~3.1:1 against the
	// dark background/card — under the 4.5:1 floor for this text-sm label —
	// so dark mode swaps to destructive-foreground (white), 16.8-18.3:1,
	// hand-verified since this pairing isn't in audit-brand-themes.py's
	// TEXT_PAIRS (only the solid destructive-foreground-on-destructive pair is).
	const labelColor = $derived.by(() => {
		if (score === 5) return 'text-success';
		if (score === 4) return 'text-info';
		if (score === 3) return 'text-highlight-foreground dark:text-highlight';
		return 'text-destructive dark:text-destructive-foreground';
	});

	// Update isValid whenever password requirements change
	$effect(() => {
		isValid = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecial;
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
		aria-label={m['passwordStrength.ariaLabel']()}
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
			<span class="font-medium {labelColor}" data-testid="strength-label">{strengthLabel}</span>
		</div>
	{/if}

	<!-- Requirements checklist -->
	{#if showRequirements && password.length > 0}
		<div class="space-y-1.5 text-xs">
			<div
				class="flex items-center gap-2 {hasMinLength
					? 'text-success'
					: 'text-destructive dark:text-destructive-foreground'}"
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
					? 'text-success'
					: 'text-destructive dark:text-destructive-foreground'}"
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
					? 'text-success'
					: 'text-destructive dark:text-destructive-foreground'}"
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
					? 'text-success'
					: 'text-destructive dark:text-destructive-foreground'}"
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
					? 'text-success'
					: 'text-destructive dark:text-destructive-foreground'}"
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
