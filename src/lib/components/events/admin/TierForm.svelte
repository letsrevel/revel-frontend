<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminCreateTicketTier,
		eventadminUpdateTicketTier,
		eventadminDeleteTicketTier
	} from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierCreateSchema,
		TicketTierUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new
		eventId: string;
		organizationStripeConnected: boolean;
		onClose: () => void;
	}

	let { tier, eventId, organizationStripeConnected, onClose }: Props = $props();

	const queryClient = useQueryClient();

	/**
	 * Convert timezone-aware ISO 8601 string to datetime-local format
	 * @param isoString - ISO 8601 string (e.g., "2025-10-24T14:30:00-07:00")
	 * @returns datetime-local format (e.g., "2025-10-24T14:30")
	 */
	function toDatetimeLocal(isoString: string | null | undefined): string {
		if (!isoString) return '';

		// Parse the ISO string to a Date (automatically handles timezone)
		const date = new Date(isoString);

		// Format as YYYY-MM-DDTHH:mm for datetime-local input
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	// Currency symbols for display
	const CURRENCY_SYMBOLS: Record<string, string> = {
		EUR: '€',
		USD: '$',
		GBP: '£',
		JPY: '¥',
		AUD: 'A$',
		CAD: 'C$',
		CHF: 'CHF',
		CNY: '¥',
		INR: '₹',
		KRW: '₩',
		RUB: '₽',
		TRY: '₺',
		BRL: 'R$',
		MXN: 'Mex$',
		ZAR: 'R'
	};

	// Supported currencies (from backend schema, alphabetically sorted)
	const SUPPORTED_CURRENCIES = [
		{ code: 'AED', name: 'UAE Dirham' },
		{ code: 'ARS', name: 'Argentine Peso' },
		{ code: 'AUD', name: 'Australian Dollar' },
		{ code: 'BDT', name: 'Bangladeshi Taka' },
		{ code: 'BGN', name: 'Bulgarian Lev' },
		{ code: 'BHD', name: 'Bahraini Dinar' },
		{ code: 'BRL', name: 'Brazilian Real' },
		{ code: 'CAD', name: 'Canadian Dollar' },
		{ code: 'CHF', name: 'Swiss Franc' },
		{ code: 'CLP', name: 'Chilean Peso' },
		{ code: 'CNY', name: 'Chinese Yuan Renminbi' },
		{ code: 'COP', name: 'Colombian Peso' },
		{ code: 'CZK', name: 'Czech Koruna' },
		{ code: 'DKK', name: 'Danish Krone' },
		{ code: 'EGP', name: 'Egyptian Pound' },
		{ code: 'EUR', name: 'Euro' },
		{ code: 'GBP', name: 'British Pound Sterling' },
		{ code: 'HKD', name: 'Hong Kong Dollar' },
		{ code: 'HRK', name: 'Croatian Kuna' },
		{ code: 'HUF', name: 'Hungarian Forint' },
		{ code: 'IDR', name: 'Indonesian Rupiah' },
		{ code: 'ILS', name: 'Israeli Shekel' },
		{ code: 'INR', name: 'Indian Rupee' },
		{ code: 'ISK', name: 'Icelandic Krona' },
		{ code: 'JPY', name: 'Japanese Yen' },
		{ code: 'KES', name: 'Kenyan Shilling' },
		{ code: 'KRW', name: 'South Korean Won' },
		{ code: 'KWD', name: 'Kuwaiti Dinar' },
		{ code: 'MAD', name: 'Moroccan Dirham' },
		{ code: 'MXN', name: 'Mexican Peso' },
		{ code: 'MYR', name: 'Malaysian Ringgit' },
		{ code: 'NGN', name: 'Nigerian Naira' },
		{ code: 'NOK', name: 'Norwegian Krone' },
		{ code: 'NZD', name: 'New Zealand Dollar' },
		{ code: 'OMR', name: 'Omani Rial' },
		{ code: 'PHP', name: 'Philippine Peso' },
		{ code: 'PKR', name: 'Pakistani Rupee' },
		{ code: 'PLN', name: 'Polish Zloty' },
		{ code: 'QAR', name: 'Qatari Riyal' },
		{ code: 'RON', name: 'Romanian Leu' },
		{ code: 'RUB', name: 'Russian Ruble' },
		{ code: 'SAR', name: 'Saudi Riyal' },
		{ code: 'SEK', name: 'Swedish Krona' },
		{ code: 'SGD', name: 'Singapore Dollar' },
		{ code: 'THB', name: 'Thai Baht' },
		{ code: 'TRY', name: 'Turkish Lira' },
		{ code: 'TWD', name: 'New Taiwan Dollar' },
		{ code: 'UAH', name: 'Ukrainian Hryvnia' },
		{ code: 'USD', name: 'US Dollar' },
		{ code: 'VND', name: 'Vietnamese Dong' },
		{ code: 'ZAR', name: 'South African Rand' }
	];

	// Form state
	let name = $state(tier?.name ?? '');
	let description = $state(tier?.description ?? '');
	let paymentMethod = $state<'free' | 'offline' | 'at_the_door' | 'online'>(
		tier?.payment_method ?? 'free'
	);
	let priceType = $state<'fixed' | 'pwyc'>(tier?.price_type ?? 'fixed');
	let price = $state(tier?.price ? String(tier.price) : '0');
	let pwycMin = $state(tier?.pwyc_min ? String(tier.pwyc_min) : '1');
	let pwycMax = $state(tier?.pwyc_max ? String(tier.pwyc_max) : '');
	let currency = $state(tier?.currency ?? 'EUR');
	let totalQuantity = $state<string>(
		tier?.total_quantity !== null && tier?.total_quantity !== undefined
			? String(tier.total_quantity)
			: ''
	);
	let salesStartAt = $state(toDatetimeLocal(tier?.sales_start_at));
	let salesEndAt = $state(toDatetimeLocal(tier?.sales_end_at));
	let visibility = $state<'public' | 'private' | 'members-only' | 'staff-only'>(
		tier?.visibility ?? 'public'
	);
	let purchasableBy = $state<'public' | 'members' | 'invited' | 'invited_and_members'>(
		tier?.purchasable_by ?? 'public'
	);

	// Get current currency symbol for display
	let currencySymbol = $derived(CURRENCY_SYMBOLS[currency] || currency);

	const tierCreateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierCreateSchema) =>
			eventadminCreateTicketTier({
				path: { event_id: eventId },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierUpdateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierUpdateSchema) =>
			eventadminUpdateTicketTier({
				path: { event_id: eventId, tier_id: tier!.id },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierDeleteMutation = createMutation(() => ({
		mutationFn: () =>
			eventadminDeleteTicketTier({
				path: { event_id: eventId, tier_id: tier!.id }
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	/**
	 * Convert datetime-local value to timezone-aware ISO 8601 string
	 * @param datetimeLocal - Value from <input type="datetime-local"> (e.g., "2025-10-24T14:30")
	 * @returns ISO 8601 string with timezone (e.g., "2025-10-24T14:30:00-07:00")
	 */
	function toTimezoneAwareISO(datetimeLocal: string): string {
		if (!datetimeLocal) return '';

		// Parse the datetime-local value as a Date in the user's local timezone
		const date = new Date(datetimeLocal);

		// Convert to ISO 8601 with timezone offset
		const tzOffset = -date.getTimezoneOffset();
		const tzHours = Math.floor(Math.abs(tzOffset) / 60)
			.toString()
			.padStart(2, '0');
		const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');
		const tzSign = tzOffset >= 0 ? '+' : '-';

		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const seconds = date.getSeconds().toString().padStart(2, '0');

		return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();

		// Build the data object, omitting null values for pwyc fields
		const baseData: any = {
			name: name.trim(),
			description: description.trim() || null,
			payment_method: paymentMethod,
			price_type: priceType,
			price: paymentMethod === 'free' ? '0' : price,
			currency,
			total_quantity: totalQuantity ? parseInt(totalQuantity) : null,
			sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
			sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null,
			visibility,
			purchasable_by: purchasableBy
		};

		// Only include pwyc fields if price_type is 'pwyc' and they have values
		if (priceType === 'pwyc') {
			if (pwycMin) {
				baseData.pwyc_min = pwycMin;
			}
			if (pwycMax) {
				baseData.pwyc_max = pwycMax;
			}
		}

		if (!tier) {
			// Create new tier
			tierCreateMutation.mutate(baseData as TicketTierCreateSchema);
		} else {
			// Update existing tier
			tierUpdateMutation.mutate(baseData as TicketTierUpdateSchema);
		}
	}

	function handleDelete() {
		if (!tier) return;
		if (!confirm(`Are you sure you want to delete the "${tier.name}" tier?`)) return;
		tierDeleteMutation.mutate();
	}

	let isPending = $derived(
		tierCreateMutation.isPending || tierUpdateMutation.isPending || tierDeleteMutation.isPending
	);
	let error = $derived(
		tierCreateMutation.error || tierUpdateMutation.error || tierDeleteMutation.error
	);
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
		<DialogHeader>
			<DialogTitle>{tier ? 'Edit Ticket Tier' : 'Create Ticket Tier'}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Tier Name -->
			<div>
				<Label for="tier-name">
					Tier Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="tier-name"
					bind:value={name}
					required
					maxlength={150}
					placeholder="e.g., General Admission, VIP Pass"
					disabled={isPending}
				/>
			</div>

			<!-- Description -->
			<div>
				<Label for="tier-description">Description (optional)</Label>
				<Textarea
					id="tier-description"
					bind:value={description}
					rows={3}
					placeholder="What's included in this tier?"
					disabled={isPending}
				/>
			</div>

			<!-- Payment Method -->
			<div>
				<Label for="payment-method">Payment Method <span class="text-destructive">*</span></Label>
				<select
					id="payment-method"
					bind:value={paymentMethod}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="free">Free</option>
					<option value="offline">Offline (Manual Payment)</option>
					<option value="at_the_door">At the Door</option>
					<option value="online" disabled={!organizationStripeConnected}>
						Online (Stripe) {!organizationStripeConnected ? '- Not Connected' : ''}
					</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if paymentMethod === 'free'}
						No payment required for this tier
					{:else if paymentMethod === 'offline'}
						Tickets marked as paid manually by admins
					{:else if paymentMethod === 'at_the_door'}
						Payment collected on-site during check-in
					{:else if paymentMethod === 'online'}
						Online payment via Stripe
					{/if}
				</p>
			</div>

			<!-- Price Settings (if not free) -->
			{#if paymentMethod !== 'free'}
				<div>
					<Label for="price-type">Price Type <span class="text-destructive">*</span></Label>
					<select
						id="price-type"
						bind:value={priceType}
						disabled={isPending}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						<option value="fixed">Fixed Price</option>
						<option value="pwyc">Pay What You Can</option>
					</select>
				</div>

				<!-- Currency Selection -->
				<div>
					<Label for="currency">Currency <span class="text-destructive">*</span></Label>
					<select
						id="currency"
						bind:value={currency}
						disabled={isPending}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{#each SUPPORTED_CURRENCIES as curr}
							<option value={curr.code}>{curr.code} - {curr.name}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-muted-foreground">
						This currency will be used for all prices in this tier
					</p>
				</div>

				{#if priceType === 'fixed'}
					<div>
						<Label for="price">Price <span class="text-destructive">*</span></Label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
								>{currencySymbol}</span
							>
							<Input
								id="price"
								type="number"
								step="0.01"
								min="0"
								bind:value={price}
								required
								disabled={isPending}
								class="pl-10"
							/>
						</div>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4">
						<div>
							<Label for="pwyc-min">Minimum Price <span class="text-destructive">*</span></Label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
									>{currencySymbol}</span
								>
								<Input
									id="pwyc-min"
									type="number"
									step="0.01"
									min="1"
									bind:value={pwycMin}
									required
									disabled={isPending}
									class="pl-10"
								/>
							</div>
						</div>
						<div>
							<Label for="pwyc-max">Maximum Price (optional)</Label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
									>{currencySymbol}</span
								>
								<Input
									id="pwyc-max"
									type="number"
									step="0.01"
									min="1"
									bind:value={pwycMax}
									disabled={isPending}
									class="pl-10"
									placeholder="No limit"
								/>
							</div>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Total Quantity -->
			<div>
				<Label for="total-quantity">Total Tickets Available</Label>
				<Input
					id="total-quantity"
					type="number"
					min="1"
					bind:value={totalQuantity}
					placeholder="Unlimited"
					disabled={isPending}
				/>
				<p class="mt-1 text-xs text-muted-foreground">Leave empty for unlimited tickets</p>
			</div>

			<!-- Sales Period -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="sales-start">Sales Start</Label>
					<Input
						id="sales-start"
						type="datetime-local"
						bind:value={salesStartAt}
						disabled={isPending}
					/>
				</div>
				<div>
					<Label for="sales-end">Sales End</Label>
					<Input
						id="sales-end"
						type="datetime-local"
						bind:value={salesEndAt}
						disabled={isPending}
					/>
				</div>
			</div>

			<!-- Visibility -->
			<div>
				<Label for="visibility">Visibility <span class="text-destructive">*</span></Label>
				<select
					id="visibility"
					bind:value={visibility}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">Public</option>
					<option value="private">Private</option>
					<option value="members-only">Members Only</option>
					<option value="staff-only">Staff Only</option>
				</select>
			</div>

			<!-- Purchasable By -->
			<div>
				<Label for="purchasable-by">Who Can Purchase <span class="text-destructive">*</span></Label>
				<select
					id="purchasable-by"
					bind:value={purchasableBy}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">Anyone</option>
					<option value="members">Members Only</option>
					<option value="invited">Invited Only</option>
					<option value="invited_and_members">Invited + Members</option>
				</select>
			</div>

			<!-- Form Actions -->
			<div class="flex justify-between gap-2 border-t border-border pt-4">
				<div>
					{#if tier}
						<Button type="button" variant="destructive" onclick={handleDelete} disabled={isPending}>
							{tierDeleteMutation.isPending ? 'Deleting...' : 'Delete Tier'}
						</Button>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button type="button" variant="outline" onclick={onClose} disabled={isPending}>
						Cancel
					</Button>
					<Button type="submit" disabled={isPending || !name.trim()}>
						{isPending ? 'Saving...' : tier ? 'Save Changes' : 'Create Tier'}
					</Button>
				</div>
			</div>

			{#if error}
				<div class="rounded-lg bg-destructive/10 p-3" role="alert">
					<p class="font-medium text-destructive">Error</p>
					<p class="mt-1 text-sm text-destructive/90">
						{error?.message || 'An error occurred. Please try again.'}
					</p>
					{#if error?.body?.detail}
						<div class="mt-2 space-y-1">
							{#if Array.isArray(error.body.detail)}
								{#each error.body.detail as detail}
									<p class="text-xs text-destructive/80">
										• {detail.loc ? detail.loc.join(' → ') + ': ' : ''}{detail.msg}
									</p>
								{/each}
							{:else if typeof error.body.detail === 'string'}
								<p class="text-xs text-destructive/80">{error.body.detail}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</form>
	</DialogContent>
</Dialog>
