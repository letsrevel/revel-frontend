<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { SUPPORTED_CURRENCIES, normalizeDecimalInput } from './tier-form-helpers';

	interface Props {
		priceType: 'fixed' | 'pwyc';
		currency: string;
		price: string;
		pwycMin: string;
		pwycMax: string;
		currencySymbol: string;
		isPending: boolean;
	}

	let {
		priceType = $bindable(),
		currency = $bindable(),
		price = $bindable(),
		pwycMin = $bindable(),
		pwycMax = $bindable(),
		currencySymbol,
		isPending
	}: Props = $props();
</script>

<div>
	<Label for="price-type">{m['tierForm.priceType']()}</Label>
	<select
		id="price-type"
		bind:value={priceType}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<option value="fixed">{m['tierForm.fixedPrice']()}</option>
		<option value="pwyc">{m['tierForm.payWhatYouCan']()}</option>
	</select>
</div>

<!-- Currency Selection -->
<div>
	<Label for="currency">{m['tierForm.currency']()}</Label>
	<select
		id="currency"
		bind:value={currency}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		{#each SUPPORTED_CURRENCIES as curr (curr.code)}
			<option value={curr.code}>{curr.code} - {curr.name}</option>
		{/each}
	</select>
	<p class="mt-1 text-xs text-muted-foreground">
		{m['tierForm.currencyHelp']()}
	</p>
</div>

{#if priceType === 'fixed'}
	<div>
		<Label for="price">{m['tierForm.price']()}</Label>
		<div class="relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				>{currencySymbol}</span
			>
			<Input
				id="price"
				type="text"
				inputmode="decimal"
				value={price}
				oninput={(e) => {
					price = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
				}}
				required
				disabled={isPending}
				class="pl-10"
			/>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-4">
		<div>
			<Label for="pwyc-min">{m['tierForm.minPrice']()}</Label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					>{currencySymbol}</span
				>
				<Input
					id="pwyc-min"
					type="text"
					inputmode="decimal"
					value={pwycMin}
					oninput={(e) => {
						pwycMin = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
					}}
					required
					disabled={isPending}
					class="pl-10"
				/>
			</div>
		</div>
		<div>
			<Label for="pwyc-max">{m['tierForm.maxPrice']()}</Label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					>{currencySymbol}</span
				>
				<Input
					id="pwyc-max"
					type="text"
					inputmode="decimal"
					value={pwycMax}
					oninput={(e) => {
						pwycMax = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
					}}
					disabled={isPending}
					class="pl-10"
					placeholder={m['tierForm.noLimitPlaceholder']()}
				/>
			</div>
		</div>
	</div>
{/if}
