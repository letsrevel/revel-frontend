<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminCreateTicketTier,
		eventadminUpdateTicketTier,
		eventadminDeleteTicketTier,
		organizationadminListVenues
	} from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierCreateSchema,
		TicketTierUpdateSchema,
		MembershipTierSchema,
		VenueDetailSchema,
		VenueSectorSchema,
		SeatAssignmentMode
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Building2, LayoutGrid, Armchair } from 'lucide-svelte';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new
		eventId: string;
		organizationSlug: string;
		organizationStripeConnected: boolean;
		membershipTiers?: MembershipTierSchema[];
		eventVenueId?: string | null; // Pre-fill venue from event
		onClose: () => void;
	}

	let {
		tier,
		eventId,
		organizationSlug,
		organizationStripeConnected,
		membershipTiers = [],
		eventVenueId = null,
		onClose
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

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
		(tier?.payment_method as 'free' | 'offline' | 'at_the_door' | 'online') ?? 'free'
	);
	let priceType = $state<'fixed' | 'pwyc'>((tier?.price_type as 'fixed' | 'pwyc') ?? 'fixed');
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
		(tier?.visibility as 'public' | 'private' | 'members-only' | 'staff-only') ?? 'public'
	);
	let purchasableBy = $state<'public' | 'members' | 'invited' | 'invited_and_members'>(
		(tier?.purchasable_by as 'public' | 'members' | 'invited' | 'invited_and_members') ?? 'public'
	);
	let restrictedToMembershipTiersIds = $state<string[]>(
		tier?.restricted_to_membership_tiers?.map((t) => t.id).filter((id): id is string => !!id) ?? []
	);

	// Venue and seating state
	let seatAssignmentMode = $state<SeatAssignmentMode>(tier?.seat_assignment_mode ?? 'none');
	let maxTicketsPerUser = $state<string>(
		tier?.max_tickets_per_user !== null && tier?.max_tickets_per_user !== undefined
			? String(tier.max_tickets_per_user)
			: ''
	);
	// Pre-fill venue: use tier's venue if editing, else fall back to event's venue
	// Venue is read-only - it always comes from the event
	let venueId = $state<string | null>(tier?.venue?.id ?? eventVenueId ?? null);

	// Check if event has a venue configured
	let hasEventVenue = $derived(!!eventVenueId);

	// Seat assignment modes other than 'none' require an event venue
	let canUseSeatAssignment = $derived(hasEventVenue);
	let sectorId = $state<string | null>(tier?.sector?.id ?? null);

	// Fetch venues for the organization (fetch when seat assignment is not 'none' OR when we have a venue pre-selected)
	const venuesQuery = createQuery<VenueDetailSchema[]>(() => ({
		queryKey: ['organization-venues', organizationSlug],
		queryFn: async () => {
			const response = await organizationadminListVenues({
				path: { slug: organizationSlug },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load venues');
			}

			return response.data?.results || [];
		},
		enabled: !!accessToken && (seatAssignmentMode !== 'none' || !!venueId)
	}));

	// Sector is required when seat assignment is random or user_choice
	let sectorRequired = $derived(seatAssignmentMode === 'random' || seatAssignmentMode === 'user_choice');
	// When sector is required, both venue and sector must be selected
	let sectorValid = $derived(!sectorRequired || (!!venueId && !!sectorId));

	// Get sectors from the selected venue
	let selectedVenueSectors = $derived.by(() => {
		if (!venueId || !venuesQuery.data) return [];
		const venue = venuesQuery.data.find((v) => v.id === venueId);
		return venue?.sectors || [];
	});

	// Clear sector when venue changes
	$effect(() => {
		if (venueId) {
			// If sector doesn't belong to current venue, clear it
			const venueHasSector = selectedVenueSectors.some((s) => s.id === sectorId);
			if (!venueHasSector && sectorId !== null) {
				sectorId = null;
			}
		} else {
			sectorId = null;
		}
	});

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
				path: { event_id: eventId, tier_id: tier!.id! },
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
				path: { event_id: eventId, tier_id: tier!.id! }
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

		// Determine the price value based on payment method and price type
		let finalPrice = '0';
		if (paymentMethod === 'free') {
			finalPrice = '0';
		} else if (priceType === 'pwyc') {
			// For PWYC (especially with Stripe), use minimum price as the price field
			finalPrice = pwycMin || '1';
		} else {
			// Fixed price
			finalPrice = price;
		}

		// Build the data object, omitting null values for pwyc fields
		const baseData: any = {
			name: name.trim(),
			description: description.trim() || null,
			payment_method: paymentMethod,
			price_type: priceType,
			price: finalPrice,
			currency,
			total_quantity: totalQuantity ? parseInt(totalQuantity) : null,
			sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
			sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null,
			visibility,
			purchasable_by: purchasableBy,
			restricted_to_membership_tiers_ids:
				restrictedToMembershipTiersIds.length > 0 ? restrictedToMembershipTiersIds : null,
			// Venue and seating configuration
			seat_assignment_mode: seatAssignmentMode,
			max_tickets_per_user: maxTicketsPerUser ? parseInt(maxTicketsPerUser) : null,
			venue_id: seatAssignmentMode !== 'none' ? venueId : null,
			sector_id: seatAssignmentMode !== 'none' ? sectorId : null
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
				<Label for="tier-description">{m['tierForm.descriptionOptional']()}</Label>
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
				<Label for="payment-method">{m['tierForm.paymentMethod']()}</Label>
				<select
					id="payment-method"
					bind:value={paymentMethod}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="free">{m['tierForm.free']()}</option>
					<option value="offline">{m['tierForm.offline']()}</option>
					<option value="at_the_door">{m['tierForm.atTheDoor']()}</option>
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
						<Label for="price">{m['tierForm.price']()}</Label>
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
							<Label for="pwyc-min">{m['tierForm.minPrice']()}</Label>
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
							<Label for="pwyc-max">{m['tierForm.maxPrice']()}</Label>
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
				<Label for="total-quantity">{m['tierForm.totalTickets']()}</Label>
				<Input
					id="total-quantity"
					type="number"
					min="1"
					bind:value={totalQuantity}
					placeholder="Unlimited"
					disabled={isPending}
				/>
				<p class="mt-1 text-xs text-muted-foreground">{m['tierForm.unlimitedTickets']()}</p>
			</div>

			<!-- Sales Period -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="sales-start">{m['tierForm.salesStart']()}</Label>
					<Input
						id="sales-start"
						type="datetime-local"
						bind:value={salesStartAt}
						disabled={isPending}
					/>
				</div>
				<div>
					<Label for="sales-end">{m['tierForm.salesEnd']()}</Label>
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
				<Label for="visibility">{m['tierForm.visibility']()}</Label>
				<select
					id="visibility"
					bind:value={visibility}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">{m['tierForm.public']()}</option>
					<option value="private">{m['tierForm.private']()}</option>
					<option value="members-only">{m['tierForm.membersOnly']()}</option>
					<option value="staff-only">{m['tierForm.staffOnly']()}</option>
				</select>
			</div>

			<!-- Purchasable By -->
			<div>
				<Label for="purchasable-by">{m['tierForm.whoCanPurchase']()}</Label>
				<select
					id="purchasable-by"
					bind:value={purchasableBy}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">{m['tierForm.anyone']()}</option>
					<option value="members">{m['tierForm.membersOnly']()}</option>
					<option value="invited">{m['tierForm.invitedOnly']()}</option>
					<option value="invited_and_members">{m['tierForm.invitedAndMembers']()}</option>
				</select>
			</div>

			<!-- Restricted to Membership Tiers -->
			{#if (purchasableBy === 'members' || purchasableBy === 'invited_and_members') && membershipTiers.length > 0}
				<div>
					<Label for="restricted-tiers">Restrict to Membership Tiers (Optional)</Label>
					<p class="mb-2 text-xs text-muted-foreground">
						If selected, only members with these tiers can purchase this ticket. Leave empty to
						allow all members.
					</p>
					<div class="space-y-2 rounded-md border border-input bg-background p-3">
						{#each membershipTiers as tier}
							{#if tier.id}
								<label class="flex cursor-pointer items-start gap-2">
									<input
										type="checkbox"
										checked={restrictedToMembershipTiersIds.includes(tier.id)}
										onchange={(e) => {
											const checked = e.currentTarget.checked;
											if (checked && tier.id && !restrictedToMembershipTiersIds.includes(tier.id)) {
												restrictedToMembershipTiersIds = [
													...restrictedToMembershipTiersIds,
													tier.id
												];
											} else if (!checked && tier.id) {
												restrictedToMembershipTiersIds = restrictedToMembershipTiersIds.filter(
													(id) => id !== tier.id
												);
											}
										}}
										disabled={isPending}
										class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
									/>
									<div class="flex-1">
										<span class="text-sm font-medium">{tier.name}</span>
										{#if tier.description}
											<p class="text-xs text-muted-foreground">{tier.description}</p>
										{/if}
									</div>
								</label>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			<!-- Seating Configuration Section -->
			<div class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
				<div class="flex items-center gap-2 text-sm font-medium">
					<Armchair class="h-4 w-4 text-primary" aria-hidden="true" />
					{m['tierForm.seatingConfig.title']?.() ?? 'Seating Configuration'}
				</div>

				<!-- Seat Assignment Mode -->
				<div>
					<Label for="seat-assignment-mode">
						{m['tierForm.seatingConfig.mode']?.() ?? 'Seat Assignment Mode'}
					</Label>
					<select
						id="seat-assignment-mode"
						bind:value={seatAssignmentMode}
						disabled={isPending}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						<option value="none">
							{m['tierForm.seatingConfig.none']?.() ?? 'General Admission (No Assigned Seats)'}
						</option>
						<option value="random" disabled={!canUseSeatAssignment}>
							{m['tierForm.seatingConfig.random']?.() ?? 'Random Assignment'}
							{!canUseSeatAssignment ? '(requires venue)' : ''}
						</option>
						<option value="user_choice" disabled={!canUseSeatAssignment}>
							{m['tierForm.seatingConfig.userChoice']?.() ?? 'User Selects Seat'}
							{!canUseSeatAssignment ? '(requires venue)' : ''}
						</option>
					</select>
					<p class="mt-1 text-xs text-muted-foreground">
						{#if !canUseSeatAssignment && seatAssignmentMode === 'none'}
							{m['tierForm.seatingConfig.noVenueConfigured']?.() ??
								'To enable seat assignment, configure a venue for this event in Basic Info.'}
						{:else if seatAssignmentMode === 'none'}
							{m['tierForm.seatingConfig.noneHelp']?.() ??
								'No seat assignment - attendees can sit anywhere'}
						{:else if seatAssignmentMode === 'random'}
							{m['tierForm.seatingConfig.randomHelp']?.() ??
								'Seats are randomly assigned to attendees'}
						{:else}
							{m['tierForm.seatingConfig.userChoiceHelp']?.() ??
								'Attendees can select their preferred seat'}
						{/if}
					</p>
				</div>

				<!-- Max Tickets Per User -->
				<div>
					<Label for="max-tickets-per-user">
						{m['tierForm.seatingConfig.maxTickets']?.() ?? 'Max Tickets Per User'}
					</Label>
					<Input
						id="max-tickets-per-user"
						type="number"
						min="1"
						bind:value={maxTicketsPerUser}
						placeholder={m['tierForm.seatingConfig.inheritFromEvent']?.() ?? 'Inherit from event'}
						disabled={isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['tierForm.seatingConfig.maxTicketsHelp']?.() ??
							'Leave empty to use the event default limit'}
					</p>
				</div>

				<!-- Venue & Sector Selection (only when seat assignment is not 'none') -->
				{#if seatAssignmentMode !== 'none'}
					<div class="space-y-4 border-t border-border pt-4">
						<div class="flex items-center gap-2 text-sm font-medium">
							<Building2 class="h-4 w-4 text-primary" aria-hidden="true" />
							{m['tierForm.seatingConfig.venueSection']?.() ?? 'Venue & Sector'}
						</div>

						<!-- Venue (read-only - comes from event) -->
						<div>
							<Label>
								{m['tierForm.seatingConfig.venue']?.() ?? 'Venue'}
							</Label>
							{#if venuesQuery.isLoading}
								<div class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
									{m['tierForm.seatingConfig.loadingVenues']?.() ?? 'Loading venue...'}
								</div>
							{:else}
								{@const selectedVenue = venuesQuery.data?.find(v => v.id === venueId)}
								<div class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
									{#if selectedVenue}
										<span class="font-medium">{selectedVenue.name}</span>
										{#if selectedVenue.capacity}
											<span class="ml-2 text-muted-foreground">({selectedVenue.capacity} capacity)</span>
										{/if}
									{:else}
										<span class="text-muted-foreground">
											{m['tierForm.seatingConfig.noVenueSelected']?.() ?? 'No venue configured for event'}
										</span>
									{/if}
								</div>
							{/if}
							<p class="mt-1 text-xs text-muted-foreground">
								{m['tierForm.seatingConfig.venueFromEvent']?.() ?? 'Venue is set at the event level in Basic Info.'}
							</p>
						</div>

						<!-- Sector (only when venue is selected) -->
						{#if venueId && selectedVenueSectors.length > 0}
							<div>
								<Label for="tier-sector">
									<span class="flex items-center gap-1">
										<LayoutGrid class="h-3.5 w-3.5" aria-hidden="true" />
										{m['tierForm.seatingConfig.sector']?.() ?? 'Sector'}
										{#if sectorRequired}
											<span class="text-destructive">*</span>
										{/if}
									</span>
								</Label>
								<select
									id="tier-sector"
									bind:value={sectorId}
									disabled={isPending}
									required={sectorRequired}
									class="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 {sectorRequired && !sectorId ? 'border-destructive' : 'border-input'}"
								>
									<option value={null}>
										{sectorRequired
											? (m['tierForm.seatingConfig.selectSectorRequired']?.() ?? 'Select a sector (required)')
											: (m['tierForm.seatingConfig.selectSector']?.() ?? 'Select a sector (optional)')}
									</option>
									{#each selectedVenueSectors as sector (sector.id)}
										<option value={sector.id}>
											{sector.name}
											{#if sector.code}({sector.code}){/if}
											{#if sector.capacity}- {sector.capacity} seats{/if}
										</option>
									{/each}
								</select>
								<p class="mt-1 text-xs {sectorRequired && !sectorId ? 'text-destructive' : 'text-muted-foreground'}">
									{#if sectorRequired}
										{m['tierForm.seatingConfig.sectorRequiredHelp']?.() ??
											'A sector is required for seat assignment modes other than General Admission'}
									{:else}
										{m['tierForm.seatingConfig.sectorHelp']?.() ??
											'Optionally restrict this tier to a specific sector'}
									{/if}
								</p>
							</div>
						{:else if venueId}
							<p class="text-xs {sectorRequired ? 'text-destructive' : 'text-muted-foreground'}">
								{#if sectorRequired}
									{m['tierForm.seatingConfig.noSectorsRequired']?.() ??
										'This venue has no sectors configured. Sectors are required for this seat assignment mode.'}
								{:else}
									{m['tierForm.seatingConfig.noSectors']?.() ??
										'This venue has no sectors configured.'}
								{/if}
							</p>
						{:else if sectorRequired}
							<p class="text-xs text-destructive">
								{m['tierForm.seatingConfig.venueRequiredForSeats']?.() ??
									'Please select a venue and sector for this seat assignment mode'}
							</p>
						{/if}
					</div>
				{/if}
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
					<Button type="submit" disabled={isPending || !name.trim() || !sectorValid}>
						{isPending ? 'Saving...' : tier ? 'Save Changes' : 'Create Tier'}
					</Button>
				</div>
			</div>

			{#if error}
				<div class="rounded-lg bg-destructive/10 p-3" role="alert">
					<p class="font-medium text-destructive">{m['tierForm.error']()}</p>
					<p class="mt-1 text-sm text-destructive/90">
						{(error as any)?.message || 'An error occurred. Please try again.'}
					</p>
					{#if (error as any)?.detail}
						<div class="mt-2 space-y-1">
							{#if Array.isArray((error as any).detail)}
								{#each (error as any).detail as detail}
									<p class="text-xs text-destructive/80">
										• {detail.loc ? detail.loc.join(' → ') + ': ' : ''}{detail.msg}
									</p>
								{/each}
							{:else if typeof (error as any).detail === 'string'}
								<p class="text-xs text-destructive/80">{(error as any).detail}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</form>
	</DialogContent>
</Dialog>
