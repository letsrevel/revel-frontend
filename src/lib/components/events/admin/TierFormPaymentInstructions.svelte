<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import AdminWarningList from '$lib/components/admin-warnings/AdminWarningList.svelte';
	import { compactWarnings } from '$lib/utils/admin-warnings/types';
	import { tierOfflineWithoutInstructions } from '$lib/utils/admin-warnings/tier';

	interface Props {
		paymentMethod: string;
		value: string;
		/** Saved tier id; unset for a new tier (no dismiss button on D4). */
		tierId?: string;
		isPending: boolean;
	}

	let { paymentMethod, value = $bindable(), tierId, isPending }: Props = $props();

	// D4 (#1314): the warning sits next to the field that fixes it, so it has no fix link.
	const warnings = $derived(
		compactWarnings([
			tierOfflineWithoutInstructions({
				payment_method: paymentMethod,
				manual_payment_instructions: value
			})
		])
	);
	const showField = $derived(paymentMethod === 'offline' || paymentMethod === 'at_the_door');
</script>

<!-- Manual Payment Instructions (for offline/at_the_door payments) -->
{#if showField}
	<div>
		<MarkdownEditor
			id="payment-instructions"
			label={m['tierForm.paymentInstructions']()}
			bind:value
			rows={3}
			placeholder={m['tierForm.paymentInstructionsPlaceholder']()}
			disabled={isPending}
		/>
		<p class="mt-1 text-xs text-muted-foreground">
			{m['tierForm.paymentInstructionsHelp']()}
		</p>
	</div>
{/if}

<!-- Outside the {#if}: a list that mounts together with its warning is never announced. D4 fires for offline only. -->
<AdminWarningList
	warnings={showField ? warnings : []}
	entityId={tierId}
	class="mt-2"
	fallbackFocusId="payment-instructions"
	testId="tier-instructions-warnings"
/>
