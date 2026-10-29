<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import CountrySelect from '$lib/components/common/CountrySelect.svelte';
	import type { PostalAddress, RequiredAddressField } from '$lib/utils/postal-address';

	interface Props {
		idPrefix: string;
		value: PostalAddress;
		required?: boolean;
		errors?: Partial<Record<RequiredAddressField, string>>;
		disabled?: boolean;
		legend?: string;
	}

	let {
		idPrefix,
		value = $bindable(),
		required = false,
		errors = {},
		disabled = false,
		legend
	}: Props = $props();

	const errorId = (field: RequiredAddressField): string => `${idPrefix}-${field}-error`;
	const describedBy = (field: RequiredAddressField): string | undefined =>
		errors[field] ? errorId(field) : undefined;
</script>

{#snippet star()}
	<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
	<span class="sr-only">{m['postalAddress.requiredSr']()}</span>
{/snippet}

{#snippet fieldError(field: RequiredAddressField)}
	{#if errors[field]}
		<p id={errorId(field)} role="alert" class="text-sm text-destructive">{errors[field]}</p>
	{/if}
{/snippet}

<fieldset class="space-y-4" {disabled}>
	<legend class={legend ? 'mb-2 text-sm font-medium' : 'sr-only'}>
		{legend ?? m['postalAddress.legend']()}
	</legend>

	<div class="space-y-2">
		<Label for="{idPrefix}-line1">
			{m['postalAddress.line1']()}
			{#if required}{@render star()}{/if}
		</Label>
		<Input
			id="{idPrefix}-line1"
			bind:value={value.line1}
			maxlength={255}
			autocomplete="address-line1"
			{required}
			aria-required={required ? 'true' : undefined}
			aria-invalid={errors.line1 ? 'true' : undefined}
			aria-describedby={describedBy('line1')}
		/>
		{@render fieldError('line1')}
	</div>

	<div class="space-y-2">
		<Label for="{idPrefix}-line2">{m['postalAddress.line2']()}</Label>
		<Input
			id="{idPrefix}-line2"
			bind:value={value.line2}
			maxlength={255}
			autocomplete="address-line2"
		/>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="space-y-2 sm:col-span-1">
			<Label for="{idPrefix}-postalCode">
				{m['postalAddress.postalCode']()}
				{#if required}{@render star()}{/if}
			</Label>
			<Input
				id="{idPrefix}-postalCode"
				bind:value={value.postalCode}
				maxlength={20}
				autocomplete="postal-code"
				{required}
				aria-required={required ? 'true' : undefined}
				aria-invalid={errors.postalCode ? 'true' : undefined}
				aria-describedby={describedBy('postalCode')}
			/>
			{@render fieldError('postalCode')}
		</div>
		<div class="space-y-2 sm:col-span-2">
			<Label for="{idPrefix}-city">
				{m['postalAddress.city']()}
				{#if required}{@render star()}{/if}
			</Label>
			<Input
				id="{idPrefix}-city"
				bind:value={value.city}
				maxlength={100}
				autocomplete="address-level2"
				{required}
				aria-required={required ? 'true' : undefined}
				aria-invalid={errors.city ? 'true' : undefined}
				aria-describedby={describedBy('city')}
			/>
			{@render fieldError('city')}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="{idPrefix}-subdivision">{m['postalAddress.subdivision']()}</Label>
			<Input
				id="{idPrefix}-subdivision"
				bind:value={value.subdivision}
				maxlength={100}
				autocomplete="address-level1"
			/>
		</div>
		<div class="space-y-2">
			<Label for="{idPrefix}-countryCode">
				{m['postalAddress.country']()}
				{#if required}{@render star()}{/if}
			</Label>
			<CountrySelect
				id="{idPrefix}-countryCode"
				bind:value={value.countryCode}
				{required}
				invalid={!!errors.countryCode}
				describedBy={describedBy('countryCode')}
				autocomplete="country"
			/>
			{@render fieldError('countryCode')}
		</div>
	</div>
</fieldset>
