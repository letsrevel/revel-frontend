<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils';
	import { getDateLocale } from '$lib/utils/date';
	import {
		ISO_COUNTRY_CODES,
		countryDisplayName,
		normalizeCountryCode
	} from '$lib/utils/postal-address';

	interface Props extends Omit<HTMLSelectAttributes, 'value' | 'placeholder'> {
		id: string;
		value?: string;
		required?: boolean;
		disabled?: boolean;
		/** Label of the empty first option. Defaults to the translated "Select a country". */
		placeholder?: string;
		describedBy?: string;
		invalid?: boolean;
	}

	let {
		id,
		value = $bindable(''),
		required = false,
		disabled = false,
		placeholder,
		describedBy,
		invalid = false,
		class: className,
		...restProps
	}: Props = $props();

	const locale = $derived(getDateLocale());

	const options = $derived.by(() => {
		const list = ISO_COUNTRY_CODES.map((code) => ({
			code,
			name: countryDisplayName(code, locale)
		}));
		list.sort((a, b) => a.name.localeCompare(b.name, locale));
		// A legacy value (e.g. "EL", or a code outside the list) must stay visible.
		const current = normalizeCountryCode(value ?? '');
		if (current && !list.some((o) => o.code === current)) {
			list.unshift({ code: current, name: countryDisplayName(current, locale) });
		}
		return list;
	});

	// Show a legacy "EL" as the normalised "GR" option.
	const selected = $derived(normalizeCountryCode(value ?? ''));
</script>

<select
	{id}
	{required}
	{disabled}
	aria-required={required ? 'true' : undefined}
	aria-invalid={invalid ? 'true' : undefined}
	aria-describedby={describedBy}
	class={cn(
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		invalid && 'border-destructive',
		className
	)}
	onchange={(e) => (value = e.currentTarget.value)}
	{...restProps}
>
	<option value="" selected={selected === ''}
		>{placeholder ?? m['postalAddress.countryPlaceholder']()}</option
	>
	{#each options as option (option.code)}
		<option value={option.code} selected={option.code === selected}>{option.name}</option>
	{/each}
</select>
