<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import type { DiscountCodeSchema, DiscountType } from '$lib/api/generated/types.gen';
	import ScopeAssignment from './ScopeAssignment.svelte';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';

	interface FormData {
		code: string;
		discount_type: DiscountType;
		discount_value: string;
		currency: string;
		valid_from: string;
		valid_until: string;
		max_uses: string;
		max_uses_per_user: string;
		min_purchase_amount: string;
		is_active: boolean;
		series_ids: string[];
		event_ids: string[];
		tier_ids: string[];
	}

	interface Props {
		organizationId: string;
		existingCode?: DiscountCodeSchema | null;
		onSubmit: (data: FormData) => Promise<void>;
		isSubmitting?: boolean;
		errorMessage?: string;
	}

	const {
		organizationId,
		existingCode = null,
		onSubmit,
		isSubmitting = false,
		errorMessage = ''
	}: Props = $props();

	const isEditing = $derived(!!existingCode);

	// Form state
	let code = $state(existingCode?.code || '');
	let discountType = $state<DiscountType>(existingCode?.discount_type || 'percentage');
	let discountValue = $state(existingCode?.discount_value || '');
	const SUPPORTED_CURRENCIES = [
		{ code: 'AUD', name: 'Australian Dollar' },
		{ code: 'BRL', name: 'Brazilian Real' },
		{ code: 'CAD', name: 'Canadian Dollar' },
		{ code: 'CHF', name: 'Swiss Franc' },
		{ code: 'CNY', name: 'Chinese Yuan' },
		{ code: 'CZK', name: 'Czech Koruna' },
		{ code: 'DKK', name: 'Danish Krone' },
		{ code: 'EUR', name: 'Euro' },
		{ code: 'GBP', name: 'British Pound' },
		{ code: 'HKD', name: 'Hong Kong Dollar' },
		{ code: 'HUF', name: 'Hungarian Forint' },
		{ code: 'IDR', name: 'Indonesian Rupiah' },
		{ code: 'ILS', name: 'Israeli New Shekel' },
		{ code: 'INR', name: 'Indian Rupee' },
		{ code: 'ISK', name: 'Icelandic Króna' },
		{ code: 'JPY', name: 'Japanese Yen' },
		{ code: 'KRW', name: 'South Korean Won' },
		{ code: 'MXN', name: 'Mexican Peso' },
		{ code: 'MYR', name: 'Malaysian Ringgit' },
		{ code: 'NOK', name: 'Norwegian Krone' },
		{ code: 'NZD', name: 'New Zealand Dollar' },
		{ code: 'PHP', name: 'Philippine Peso' },
		{ code: 'PLN', name: 'Polish Złoty' },
		{ code: 'RON', name: 'Romanian Leu' },
		{ code: 'SEK', name: 'Swedish Krona' },
		{ code: 'SGD', name: 'Singapore Dollar' },
		{ code: 'THB', name: 'Thai Baht' },
		{ code: 'TRY', name: 'Turkish Lira' },
		{ code: 'USD', name: 'US Dollar' },
		{ code: 'ZAR', name: 'South African Rand' }
	];
	let currency = $state(existingCode?.currency || 'EUR');
	// `validFrom` / `validUntil` hold ISO 8601 strings (DateTimePicker's value format).
	let validFrom = $state(existingCode?.valid_from ?? '');
	let validUntil = $state(existingCode?.valid_until ?? '');
	// Tracks the scoped-event date we auto-filled into `validUntil`, and whether the
	// organizer has since edited the field manually (so we stop managing it).
	let autoPrefilledValidUntil = $state<string | null>(null);
	let validUntilManuallyEdited = $state(false);
	let maxUses = $state(existingCode?.max_uses?.toString() || '');
	let maxUsesPerUser = $state(existingCode?.max_uses_per_user?.toString() || '1');
	let minPurchaseAmount = $state(existingCode?.min_purchase_amount || '0');
	let isActive = $state(existingCode?.is_active ?? true);
	let seriesIds = $state<string[]>(existingCode?.series_ids || []);
	let eventIds = $state<string[]>(existingCode?.event_ids || []);
	let tierIds = $state<string[]>(existingCode?.tier_ids || []);

	// Validation
	let validationErrors = $state<Record<string, string>>({});

	/**
	 * Keep "Valid Until" in sync with the single scoped event's date (revel-frontend#444).
	 * Only manages the field while creating and the organizer hasn't edited it manually.
	 * - A single future event fills/updates the field (replacing a prior auto-fill).
	 * - Losing the single-event scope (0 or 2+ events), or a past-dated event, clears our
	 *   own auto-fill but never touches a value the organizer set themselves.
	 * Never prefills a past date (which would create an already-expired code).
	 */
	function handleScopedEventDate(startIso: string | null): void {
		if (isEditing || validUntilManuallyEdited) return;

		// Only a future single-event start is usable as a prefill.
		const usable = startIso && new Date(startIso).getTime() > Date.now() ? startIso : null;

		if (!usable) {
			// Drop our own auto-fill when the prefill no longer applies; leave manual values be.
			if (validUntil && validUntil === autoPrefilledValidUntil) {
				validUntil = '';
				autoPrefilledValidUntil = null;
			}
			return;
		}

		// Fill an empty field, or replace a value we previously auto-filled.
		if (!validUntil || validUntil === autoPrefilledValidUntil) {
			validUntil = usable;
			autoPrefilledValidUntil = usable;
		}
	}

	/** Mark the field as organizer-owned once they change it away from our auto-fill. */
	function handleValidUntilChange(value: string): void {
		if (value !== autoPrefilledValidUntil) {
			validUntilManuallyEdited = true;
			autoPrefilledValidUntil = null;
		}
	}

	const showCurrency = $derived(discountType === 'fixed_amount' && tierIds.length === 0);

	function validate(): boolean {
		const errors: Record<string, string> = {};

		const codeStr = String(code ?? '');
		const valueStr = String(discountValue ?? '');
		const currencyStr = String(currency ?? '');
		const maxUsesStr = String(maxUses ?? '');
		const maxUsesPerUserStr = String(maxUsesPerUser ?? '');
		const minPurchaseStr = String(minPurchaseAmount ?? '');

		if (!codeStr.trim()) {
			errors.code = m['discountCodeForm.errorCodeRequired']();
		} else if (!/^[\p{L}\p{N}]+$/u.test(codeStr.trim())) {
			errors.code = m['discountCodeForm.errorCodeAlphanumeric']();
		} else if (codeStr.trim().length > 64) {
			errors.code = m['discountCodeForm.errorCodeTooLong']();
		}

		if (!valueStr.trim()) {
			errors.discount_value = m['discountCodeForm.errorValueRequired']();
		} else {
			const val = parseFloat(valueStr);
			if (isNaN(val) || val <= 0) {
				errors.discount_value = m['discountCodeForm.errorValuePositive']();
			} else if (discountType === 'percentage' && val > 100) {
				errors.discount_value = m['discountCodeForm.errorPercentageMax']();
			}
		}

		if (discountType === 'fixed_amount' && tierIds.length === 0 && !currencyStr.trim()) {
			errors.currency = m['discountCodeForm.errorCurrencyRequired']();
		}

		if (validFrom && validUntil) {
			if (new Date(validFrom) >= new Date(validUntil)) {
				errors.valid_until = m['discountCodeForm.errorEndAfterStart']();
			}
		}

		if (maxUsesStr.trim()) {
			const val = parseInt(maxUsesStr);
			if (isNaN(val) || val < 1) {
				errors.max_uses = m['discountCodeForm.errorAtLeastOne']();
			}
		}

		if (maxUsesPerUserStr.trim()) {
			const val = parseInt(maxUsesPerUserStr);
			if (isNaN(val) || val < 1) {
				errors.max_uses_per_user = m['discountCodeForm.errorAtLeastOne']();
			}
		}

		if (minPurchaseStr.trim()) {
			const val = parseFloat(minPurchaseStr);
			if (isNaN(val) || val < 0) {
				errors.min_purchase_amount = m['discountCodeForm.errorZeroOrMore']();
			}
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		await onSubmit({
			code: String(code ?? '')
				.trim()
				.toUpperCase(),
			discount_type: discountType,
			discount_value: String(discountValue ?? '').trim(),
			currency: showCurrency
				? String(currency ?? '')
						.trim()
						.toUpperCase()
				: '',
			valid_from: validFrom ? new Date(validFrom).toISOString() : '',
			valid_until: validUntil ? new Date(validUntil).toISOString() : '',
			max_uses: String(maxUses ?? '').trim(),
			max_uses_per_user: String(maxUsesPerUser ?? '').trim() || '1',
			min_purchase_amount: String(minPurchaseAmount ?? '').trim() || '0',
			is_active: isActive,
			series_ids: seriesIds,
			event_ids: eventIds,
			tier_ids: tierIds
		});
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Error -->
	{#if errorMessage}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{errorMessage}</AlertDescription>
		</Alert>
	{/if}

	<!-- Code -->
	<div class="space-y-2">
		<Label for="code">{m['discountCodeForm.codeLabel']()}</Label>
		<Input
			id="code"
			type="text"
			bind:value={code}
			placeholder={m['discountCodeForm.codePlaceholder']()}
			disabled={isEditing || isSubmitting}
			maxlength={64}
			class="uppercase"
			aria-invalid={validationErrors.code ? 'true' : undefined}
			aria-describedby={validationErrors.code ? 'code-error' : undefined}
			oninput={() => {
				code = String(code ?? '')
					.replace(/[^\p{L}\p{N}]/gu, '')
					.toUpperCase();
			}}
		/>
		{#if isEditing}
			<p class="text-xs text-muted-foreground">{m['discountCodeForm.codeImmutable']()}</p>
		{/if}
		{#if validationErrors.code}
			<p id="code-error" class="text-sm text-destructive">{validationErrors.code}</p>
		{/if}
	</div>

	<!-- Discount Type -->
	<div class="space-y-2">
		<Label>{m['discountCodeForm.discountTypeLabel']()}</Label>
		<div class="flex gap-4">
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="radio"
					name="discount_type"
					value="percentage"
					bind:group={discountType}
					disabled={isSubmitting}
					class="h-4 w-4 border-input text-primary focus:ring-primary"
				/>
				<span class="text-sm">{m['discountCodeForm.percentage']()}</span>
			</label>
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="radio"
					name="discount_type"
					value="fixed_amount"
					bind:group={discountType}
					disabled={isSubmitting}
					class="h-4 w-4 border-input text-primary focus:ring-primary"
				/>
				<span class="text-sm">{m['discountCodeForm.fixedAmount']()}</span>
			</label>
		</div>
	</div>

	<!-- Discount Value + Currency -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="discount_value">
				{m['discountCodeForm.discountValueLabel']()}
				{#if discountType === 'percentage'}
					<span class="text-muted-foreground">{m['discountCodeForm.range1to100']()}</span>
				{/if}
			</Label>
			<div class="relative">
				<Input
					id="discount_value"
					type="text"
					inputmode="decimal"
					value={discountValue}
					oninput={(e) => {
						discountValue = (e.currentTarget as HTMLInputElement).value
							.replace(/,/g, '.')
							.replace(/[^\d.]/g, '');
					}}
					placeholder={discountType === 'percentage' ? '20' : '5.00'}
					disabled={isSubmitting}
					aria-invalid={validationErrors.discount_value ? 'true' : undefined}
					aria-describedby={validationErrors.discount_value ? 'value-error' : undefined}
				/>
				{#if discountType === 'percentage'}
					<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
						%
					</span>
				{/if}
			</div>
			{#if validationErrors.discount_value}
				<p id="value-error" class="text-sm text-destructive">
					{validationErrors.discount_value}
				</p>
			{/if}
		</div>

		{#if showCurrency}
			<div class="space-y-2">
				<Label for="currency">{m['discountCodeForm.currencyLabel']()}</Label>
				<select
					id="currency"
					bind:value={currency}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					aria-invalid={validationErrors.currency ? 'true' : undefined}
					aria-describedby={validationErrors.currency ? 'currency-error' : undefined}
				>
					{#each SUPPORTED_CURRENCIES as curr}
						<option value={curr.code}>{curr.code} - {curr.name}</option>
					{/each}
				</select>
				{#if validationErrors.currency}
					<p id="currency-error" class="text-sm text-destructive">
						{validationErrors.currency}
					</p>
				{/if}
			</div>
		{:else if discountType === 'fixed_amount' && tierIds.length > 0}
			<div class="space-y-2">
				<Label class="text-muted-foreground">{m['discountCodeForm.currencyLabel']()}</Label>
				<p class="text-xs text-muted-foreground">{m['discountCodeForm.currencyInherited']()}</p>
			</div>
		{/if}
	</div>

	<!-- Validity Period -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<DateTimePicker
				id="valid_from"
				label={m['discountCodeForm.validFromLabel']()}
				bind:value={validFrom}
				disabled={isSubmitting}
			/>
			<p class="text-xs text-muted-foreground">{m['discountCodeForm.validFromHelp']()}</p>
		</div>

		<div class="space-y-2">
			<DateTimePicker
				id="valid_until"
				label={m['discountCodeForm.validUntilLabel']()}
				bind:value={validUntil}
				disabled={isSubmitting}
				error={validationErrors.valid_until}
				onValueChange={handleValidUntilChange}
			/>
			{#if !validationErrors.valid_until}
				<p class="text-xs text-muted-foreground">{m['discountCodeForm.validUntilHelp']()}</p>
			{/if}
		</div>
	</div>

	<!-- Usage Limits -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="space-y-2">
			<Label for="max_uses">{m['discountCodeForm.maxTotalUsesLabel']()}</Label>
			<Input
				id="max_uses"
				type="number"
				bind:value={maxUses}
				placeholder={m['discountCodeForm.unlimited']()}
				disabled={isSubmitting}
				min="1"
				aria-invalid={validationErrors.max_uses ? 'true' : undefined}
				aria-describedby={validationErrors.max_uses ? 'max-uses-error' : undefined}
			/>
			{#if validationErrors.max_uses}
				<p id="max-uses-error" class="text-sm text-destructive">
					{validationErrors.max_uses}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">{m['discountCodeForm.maxUsesHelp']()}</p>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="max_uses_per_user">{m['discountCodeForm.maxPerUserLabel']()}</Label>
			<Input
				id="max_uses_per_user"
				type="number"
				bind:value={maxUsesPerUser}
				disabled={isSubmitting}
				min="1"
				aria-invalid={validationErrors.max_uses_per_user ? 'true' : undefined}
				aria-describedby={validationErrors.max_uses_per_user ? 'max-user-error' : undefined}
			/>
			{#if validationErrors.max_uses_per_user}
				<p id="max-user-error" class="text-sm text-destructive">
					{validationErrors.max_uses_per_user}
				</p>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="min_purchase_amount">{m['discountCodeForm.minPurchaseLabel']()}</Label>
			<Input
				id="min_purchase_amount"
				type="text"
				inputmode="decimal"
				value={minPurchaseAmount}
				oninput={(e) => {
					minPurchaseAmount = (e.currentTarget as HTMLInputElement).value
						.replace(/,/g, '.')
						.replace(/[^\d.]/g, '');
				}}
				disabled={isSubmitting}
				aria-invalid={validationErrors.min_purchase_amount ? 'true' : undefined}
				aria-describedby={validationErrors.min_purchase_amount ? 'min-amount-error' : undefined}
			/>
			{#if validationErrors.min_purchase_amount}
				<p id="min-amount-error" class="text-sm text-destructive">
					{validationErrors.min_purchase_amount}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">{m['discountCodeForm.minPurchaseHelp']()}</p>
			{/if}
		</div>
	</div>

	<!-- Active Toggle -->
	<div class="flex items-center gap-3">
		<label class="relative inline-flex cursor-pointer items-center">
			<input
				type="checkbox"
				bind:checked={isActive}
				disabled={isSubmitting}
				class="peer sr-only"
				role="switch"
				aria-label={m['discountCodeForm.activeStatus']()}
			/>
			<div
				class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-ring dark:bg-gray-700"
			></div>
		</label>
		<div>
			<span class="text-sm font-medium">{m['discountCodeForm.active']()}</span>
			<p class="text-xs text-muted-foreground">
				{isActive ? m['discountCodeForm.activeOn']() : m['discountCodeForm.activeOff']()}
			</p>
		</div>
	</div>

	<!-- Scope Assignment -->
	<div class="rounded-lg border p-4">
		<ScopeAssignment
			{organizationId}
			selectedSeriesIds={seriesIds}
			selectedEventIds={eventIds}
			selectedTierIds={tierIds}
			onSeriesChange={(ids) => (seriesIds = ids)}
			onEventsChange={(ids) => (eventIds = ids)}
			onTiersChange={(ids) => (tierIds = ids)}
			onScopedEventDateChange={handleScopedEventDate}
			disabled={isSubmitting}
		/>
	</div>

	<!-- Usage stats (edit mode only) -->
	{#if isEditing && existingCode}
		<div class="rounded-lg border bg-muted/50 p-4">
			<h3 class="text-sm font-medium">{m['discountCodeForm.usageStatistics']()}</h3>
			<p class="mt-1 text-2xl font-bold">
				{existingCode.times_used ?? 0}
				<span class="text-sm font-normal text-muted-foreground">
					/ {existingCode.max_uses ?? '∞'}
					{m['discountCodeForm.uses']()}
				</span>
			</p>
		</div>
	{/if}

	<!-- Submit -->
	<div class="flex gap-3">
		<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
			{#if isSubmitting}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{isEditing ? m['discountCodeForm.saving']() : m['discountCodeForm.creating']()}
			{:else}
				{isEditing ? m['discountCodeForm.saveChanges']() : m['discountCodeForm.createCode']()}
			{/if}
		</Button>
	</div>
</form>
