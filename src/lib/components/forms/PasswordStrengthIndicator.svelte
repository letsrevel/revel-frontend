<script lang="ts">
	import { calculatePasswordStrength } from '$lib/schemas/auth';

	interface Props {
		password: string;
		showLabel?: boolean;
	}

	let { password, showLabel = true }: Props = $props();

	let strength = $derived(calculatePasswordStrength(password));
	let widthPercentage = $derived((strength.score / 4) * 100);
</script>

<div class="space-y-2" role="status" aria-live="polite">
	<!-- Progress bar -->
	<div
		class="h-2 w-full overflow-hidden rounded-full bg-muted"
		role="progressbar"
		aria-valuenow={strength.score}
		aria-valuemin={0}
		aria-valuemax={4}
		aria-label="Password strength"
	>
		<div
			class="h-full transition-all duration-300 {strength.color}"
			style="width: {widthPercentage}%"
		></div>
	</div>

	<!-- Label and description -->
	{#if showLabel && password.length > 0}
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted-foreground">Password strength:</span>
			<span class="font-medium" data-testid="strength-label">{strength.label}</span>
		</div>
	{/if}
</div>
