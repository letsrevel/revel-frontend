<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle, Loader2 } from 'lucide-svelte';
	import type { DiscountCodeSchema, DiscountType } from '$lib/api/generated/types.gen';
	import ScopeAssignment from './ScopeAssignment.svelte';

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
		{ code: 'BGN', name: 'Bulgarian Lev' },
		{ code: 'CHF', name: 'Swiss Franc' },
		{ code: 'CZK', name: 'Czech Koruna' },
		{ code: 'DKK', name: 'Danish Krone' },
		{ code: 'EUR', name: 'Euro' },
		{ code: 'GBP', name: 'British Pound' },
		{ code: 'HUF', name: 'Hungarian Forint' },
		{ code: 'PLN', name: 'Polish Zloty' },
		{ code: 'RON', name: 'Romanian Leu' },
		{ code: 'SEK', name: 'Swedish Krona' },
		{ code: 'USD', name: 'US Dollar' }
	];
	let currency = $state(existingCode?.currency || 'EUR');
	let validFrom = $state(existingCode?.valid_from ? toLocalDatetime(existingCode.valid_from) : '');
	let validUntil = $state(
		existingCode?.valid_until ? toLocalDatetime(existingCode.valid_until) : ''
	);
	let maxUses = $state(existingCode?.max_uses?.toString() || '');
	let maxUsesPerUser = $state(existingCode?.max_uses_per_user?.toString() || '1');
	let minPurchaseAmount = $state(existingCode?.min_purchase_amount || '0');
	let isActive = $state(existingCode?.is_active ?? true);
	let seriesIds = $state<string[]>(existingCode?.series_ids || []);
	let eventIds = $state<string[]>(existingCode?.event_ids || []);
	let tierIds = $state<string[]>(existingCode?.tier_ids || []);

	// Validation
	let validationErrors = $state<Record<string, string>>({});

	function toLocalDatetime(iso: string): string {
		const d = new Date(iso);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
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
			errors.code = 'Code is required';
		} else if (codeStr.trim().length > 64) {
			errors.code = 'Code must be 64 characters or less';
		}

		if (!valueStr.trim()) {
			errors.discount_value = 'Discount value is required';
		} else {
			const val = parseFloat(valueStr);
			if (isNaN(val) || val <= 0) {
				errors.discount_value = 'Must be a positive number';
			} else if (discountType === 'percentage' && val > 100) {
				errors.discount_value = 'Percentage cannot exceed 100';
			}
		}

		if (discountType === 'fixed_amount' && tierIds.length === 0 && !currencyStr.trim()) {
			errors.currency = 'Currency is required for fixed amount discounts without tier scope';
		}

		if (validFrom && validUntil) {
			if (new Date(validFrom) >= new Date(validUntil)) {
				errors.valid_until = 'End date must be after start date';
			}
		}

		if (maxUsesStr.trim()) {
			const val = parseInt(maxUsesStr);
			if (isNaN(val) || val < 1) {
				errors.max_uses = 'Must be at least 1';
			}
		}

		if (maxUsesPerUserStr.trim()) {
			const val = parseInt(maxUsesPerUserStr);
			if (isNaN(val) || val < 1) {
				errors.max_uses_per_user = 'Must be at least 1';
			}
		}

		if (minPurchaseStr.trim()) {
			const val = parseFloat(minPurchaseStr);
			if (isNaN(val) || val < 0) {
				errors.min_purchase_amount = 'Must be 0 or more';
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
		<Label for="code">Code</Label>
		<Input
			id="code"
			type="text"
			bind:value={code}
			placeholder="e.g. SUMMER20"
			disabled={isEditing || isSubmitting}
			maxlength={64}
			class="uppercase"
			aria-invalid={validationErrors.code ? 'true' : undefined}
			aria-describedby={validationErrors.code ? 'code-error' : undefined}
		/>
		{#if isEditing}
			<p class="text-xs text-muted-foreground">Code cannot be changed after creation.</p>
		{/if}
		{#if validationErrors.code}
			<p id="code-error" class="text-sm text-destructive">{validationErrors.code}</p>
		{/if}
	</div>

	<!-- Discount Type -->
	<div class="space-y-2">
		<Label>Discount Type</Label>
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
				<span class="text-sm">Percentage (%)</span>
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
				<span class="text-sm">Fixed Amount</span>
			</label>
		</div>
	</div>

	<!-- Discount Value + Currency -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="discount_value">
				Discount Value
				{#if discountType === 'percentage'}
					<span class="text-muted-foreground">(1-100)</span>
				{/if}
			</Label>
			<div class="relative">
				<Input
					id="discount_value"
					type="number"
					bind:value={discountValue}
					placeholder={discountType === 'percentage' ? '20' : '5.00'}
					disabled={isSubmitting}
					min={discountType === 'percentage' ? '1' : '0.01'}
					max={discountType === 'percentage' ? '100' : undefined}
					step={discountType === 'percentage' ? '1' : '0.01'}
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
				<Label for="currency">Currency</Label>
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
				<Label class="text-muted-foreground">Currency</Label>
				<p class="text-xs text-muted-foreground">Currency is inherited from the linked tier(s).</p>
			</div>
		{/if}
	</div>

	<!-- Validity Period -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="valid_from">Valid From</Label>
			<Input id="valid_from" type="datetime-local" bind:value={validFrom} disabled={isSubmitting} />
			<p class="text-xs text-muted-foreground">Leave empty for immediately valid</p>
		</div>

		<div class="space-y-2">
			<Label for="valid_until">Valid Until</Label>
			<Input
				id="valid_until"
				type="datetime-local"
				bind:value={validUntil}
				disabled={isSubmitting}
				aria-invalid={validationErrors.valid_until ? 'true' : undefined}
				aria-describedby={validationErrors.valid_until ? 'until-error' : undefined}
			/>
			{#if validationErrors.valid_until}
				<p id="until-error" class="text-sm text-destructive">
					{validationErrors.valid_until}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">Leave empty for no expiry</p>
			{/if}
		</div>
	</div>

	<!-- Usage Limits -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="space-y-2">
			<Label for="max_uses">Max Total Uses</Label>
			<Input
				id="max_uses"
				type="number"
				bind:value={maxUses}
				placeholder="Unlimited"
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
				<p class="text-xs text-muted-foreground">Leave empty for unlimited</p>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="max_uses_per_user">Max Per User</Label>
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
			<Label for="min_purchase_amount">Min Purchase Amount</Label>
			<Input
				id="min_purchase_amount"
				type="number"
				bind:value={minPurchaseAmount}
				disabled={isSubmitting}
				min="0"
				step="0.01"
				aria-invalid={validationErrors.min_purchase_amount ? 'true' : undefined}
				aria-describedby={validationErrors.min_purchase_amount ? 'min-amount-error' : undefined}
			/>
			{#if validationErrors.min_purchase_amount}
				<p id="min-amount-error" class="text-sm text-destructive">
					{validationErrors.min_purchase_amount}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">Price x quantity threshold</p>
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
				aria-label="Active status"
			/>
			<div
				class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-ring dark:bg-gray-700"
			></div>
		</label>
		<div>
			<span class="text-sm font-medium">Active</span>
			<p class="text-xs text-muted-foreground">
				{isActive ? 'Code can be used at checkout' : 'Code is disabled'}
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
			disabled={isSubmitting}
		/>
	</div>

	<!-- Usage stats (edit mode only) -->
	{#if isEditing && existingCode}
		<div class="rounded-lg border bg-muted/50 p-4">
			<h3 class="text-sm font-medium">Usage Statistics</h3>
			<p class="mt-1 text-2xl font-bold">
				{existingCode.times_used ?? 0}
				<span class="text-sm font-normal text-muted-foreground">
					/ {existingCode.max_uses ?? '∞'} uses
				</span>
			</p>
		</div>
	{/if}

	<!-- Submit -->
	<div class="flex gap-3">
		<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
			{#if isSubmitting}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{isEditing ? 'Saving...' : 'Creating...'}
			{:else}
				{isEditing ? 'Save Changes' : 'Create Discount Code'}
			{/if}
		</Button>
	</div>
</form>
