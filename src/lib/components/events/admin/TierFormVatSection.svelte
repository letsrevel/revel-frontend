<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { normalizeDecimalInput } from './tier-form-helpers';
	import { schemeAdjustedOverride, vatExemptionVisible, type OrgVatContext } from './tier-vat';

	interface Props {
		paymentMethod: string;
		vatRateOverride: string;
		vatExemptionReason: string;
		/** Org VAT defaults; null when unavailable (the input then follows an explicit 0 override). */
		orgVat?: OrgVatContext | null;
		/** The reason is mandatory for this tier (see vatExemptionRequired). */
		required?: boolean;
		/** Announced validation error for the reason input. */
		error?: string;
		isPending: boolean;
	}

	let {
		paymentMethod,
		vatRateOverride = $bindable(),
		vatExemptionReason = $bindable(),
		orgVat = null,
		required = false,
		error = '',
		isPending
	}: Props = $props();

	const schemeFixed = $derived(orgVat?.smallBusiness === true);

	// Under a small-business scheme a positive override would be refused: inherit the org's 0%.
	$effect(() => {
		const next = schemeAdjustedOverride(vatRateOverride, orgVat);
		if (next !== vatRateOverride) vatRateOverride = next;
	});

	const showReason = $derived(vatExemptionVisible(paymentMethod, vatRateOverride, orgVat));
	const orgDefault = $derived((orgVat?.exemptionReason ?? '').trim());
	const showOrgDefaultHint = $derived(orgDefault !== '' && vatExemptionReason.trim() === '');
	const describedBy = $derived(
		[
			'vat-exemption-reason-hint',
			showOrgDefaultHint ? 'vat-exemption-reason-default' : '',
			error ? 'vat-exemption-reason-error' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if paymentMethod !== 'free'}
	<div>
		<Label for="vat-rate-override">{m['tierForm.vatRateOverride']()}</Label>
		<Input
			id="vat-rate-override"
			type="text"
			inputmode="decimal"
			value={vatRateOverride}
			oninput={(e) => {
				vatRateOverride = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
			}}
			placeholder={m['tierForm.vatRateOverridePlaceholder']()}
			disabled={isPending || schemeFixed}
			aria-describedby={schemeFixed ? 'vat-rate-override-scheme' : undefined}
		/>
		{#if schemeFixed}
			<p id="vat-rate-override-scheme" class="mt-1 text-xs text-muted-foreground">
				{m['smallBiz.vatRateFixedTier']()}
			</p>
		{:else}
			<p class="mt-1 text-xs text-muted-foreground">
				{m['tierForm.vatRateOverrideHelp']()}
			</p>
		{/if}
	</div>

	{#if showReason}
		<div>
			<Label for="vat-exemption-reason">
				{m['tierForm.vatExemptionReason']()}
				{#if required}
					<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
					<span class="sr-only">{m['tierForm.requiredSr']()}</span>
				{/if}
			</Label>
			<Input
				id="vat-exemption-reason"
				type="text"
				bind:value={vatExemptionReason}
				maxlength={255}
				required={required || undefined}
				aria-required={required ? 'true' : undefined}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={describedBy}
				disabled={isPending}
			/>
			<p id="vat-exemption-reason-hint" class="mt-1 text-xs text-muted-foreground">
				{m['tierForm.vatExemptionReasonHint']()}
			</p>
			{#if showOrgDefaultHint}
				<p id="vat-exemption-reason-default" class="mt-1 text-xs text-muted-foreground">
					{m['tierForm.vatExemptionReasonOrgDefault']({ reason: orgDefault })}
				</p>
			{/if}
			{#if error}
				<p id="vat-exemption-reason-error" class="mt-1 text-sm text-destructive" role="alert">
					{error}
				</p>
			{/if}
		</div>
	{/if}
{/if}
