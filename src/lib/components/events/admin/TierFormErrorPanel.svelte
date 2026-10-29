<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { extractErrorMessage, extractFieldErrors } from '$lib/utils/errors';
	import { tierFieldLabel } from './tier-field-labels';
	import { isBillingInfoRequiredError } from './tier-form-helpers';

	interface Props {
		error: unknown;
		/** Last save's HTTP status: a plain-detail 422 is a country-rule refusal (#1001). */
		saveStatus?: number;
		paymentMethod: string;
		organizationSlug: string;
		/** Submitted tier is 0% with no exemption reason: that, not the country rule, is the likely cause. */
		exemptionLikelyCause?: boolean;
	}

	const {
		error,
		saveStatus,
		paymentMethod,
		organizationSlug,
		exemptionLikelyCause = false
	}: Props = $props();

	const fieldErrors = $derived(extractFieldErrors(error));
	const errorMsg = $derived(extractErrorMessage(error));
	const isBillingError = $derived(isBillingInfoRequiredError(errorMsg));
</script>

<!-- This panel renders inside DialogContent (bg-background), but the
	     dimmed copy stops at /90 so it stays AA on a card surface too:
	     5.61:1 / 5.18:1 dark, vs 4.71:1 / 4.40:1 at /80. Audited on both
	     in scripts/audit-brand-themes.py. -->
<div class="rounded-lg bg-destructive/10 p-3" role="alert">
	<p class="font-medium text-destructive">{m['tierForm.error']()}</p>

	{#if fieldErrors.length > 0}
		<p class="mt-1 text-sm text-destructive/90">
			{m['tierForm.fieldErrorsTitle']()}
		</p>
		<ul class="mt-1 space-y-1">
			{#each fieldErrors as { field, messages } (field)}
				<li class="text-sm text-destructive/90">
					<span class="font-medium">{tierFieldLabel(field)}:</span>
					{messages.join(', ')}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-1 text-sm text-destructive/90">{errorMsg}</p>
		{#if saveStatus === 422 && paymentMethod === 'online' && !isBillingError && !exemptionLikelyCause}
			<p class="mt-1 text-sm text-destructive/90">{m['compliance.tier.locationHint']()}</p>
		{/if}
	{/if}

	{#if isBillingError}
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing', { slug: organizationSlug })}
			class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-destructive underline hover:text-destructive/90"
		>
			{m['tierForm.completeBillingInfo']()}
		</a>
	{/if}
</div>
