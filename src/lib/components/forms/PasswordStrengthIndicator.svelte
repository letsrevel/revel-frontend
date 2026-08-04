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
			<span class="font-medium text-muted-foreground" data-testid="strength-label"
				>{strengthLabel}</span
			>
		</div>
	{/if}

	<!-- Requirements checklist: row text stays on text-muted-foreground; only the
	     Check/X icons carry the met/unmet color. `text-destructive` resolves to
	     --destructive-text (issue #781), which is 8.63:1 on the light background
	     and 7.02:1 / 6.42:1 on the dark background / card — comfortably over the
	     3:1 non-text floor (WCAG 1.4.11) in both modes. The earlier dark-mode
	     swap to white existed only because the utility used to resolve to the
	     FILL value, which measured 2.85:1 here; both rows are TEXT_PAIRS in
	     scripts/audit-brand-themes.py now, so this can't drift unnoticed. -->
	{#if showRequirements && password.length > 0}
		<div class="space-y-1.5 text-xs">
			<div class="flex items-center gap-2 text-muted-foreground">
				{#if hasMinLength}
					<Check class="h-3.5 w-3.5 text-success" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.atLeast8']()}</span>
			</div>

			<div class="flex items-center gap-2 text-muted-foreground">
				{#if hasUppercase}
					<Check class="h-3.5 w-3.5 text-success" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneUppercase']()}</span>
			</div>

			<div class="flex items-center gap-2 text-muted-foreground">
				{#if hasLowercase}
					<Check class="h-3.5 w-3.5 text-success" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneLowercase']()}</span>
			</div>

			<div class="flex items-center gap-2 text-muted-foreground">
				{#if hasDigit}
					<Check class="h-3.5 w-3.5 text-success" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneNumber']()}</span>
			</div>

			<div class="flex items-center gap-2 text-muted-foreground">
				{#if hasSpecial}
					<Check class="h-3.5 w-3.5 text-success" aria-hidden="true" />
				{:else}
					<X class="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
				{/if}
				<span>{m['passwordStrength.oneSpecial']()}</span>
			</div>
		</div>
	{/if}
</div>
