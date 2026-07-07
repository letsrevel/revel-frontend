<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminticketsCreateTicketTier,
		eventadminticketsUpdateTicketTier,
		eventadminticketsDeleteTicketTier,
		organizationadminvenuesListVenues
	} from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierCreateSchema,
		TicketTierUpdateSchema,
		MembershipTierSchema,
		VenueDetailSchema,
		SeatAssignmentMode,
		RefundPolicy
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { DurationInput } from '$lib/components/forms';
	import RefundPolicyEditor from './RefundPolicyEditor.svelte';
	import TierFormPricingSection from './TierFormPricingSection.svelte';
	import TierFormAvailabilitySection from './TierFormAvailabilitySection.svelte';
	import TierFormSeatingSection from './TierFormSeatingSection.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractErrorMessage, extractFieldErrors } from '$lib/utils/errors';
	import { tierFieldLabel } from './tier-field-labels';
	import {
		CURRENCY_SYMBOLS,
		toDatetimeLocal,
		toTimezoneAwareISO,
		normalizeDecimalInput
	} from './tier-form-helpers';
	import { Undo2 } from '@lucide/svelte';
	import { formatDateTimeReadback } from '$lib/utils/date';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new
		eventId: string;
		organizationSlug: string;
		organizationStripeConnected: boolean;
		membershipTiers?: MembershipTierSchema[];
		eventVenueId?: string | null; // Pre-fill venue from event
		onClose: () => void;
	}

	const {
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
	let vatRateOverride = $state(tier?.vat_rate != null ? String(tier.vat_rate) : '');
	let manualPaymentInstructions = $state(tier?.manual_payment_instructions ?? '');
	let totalQuantity = $state<string>(
		tier?.total_quantity !== null && tier?.total_quantity !== undefined
			? String(tier.total_quantity)
			: ''
	);
	let salesStartAt = $state(toDatetimeLocal(tier?.sales_start_at));
	let salesEndAt = $state(toDatetimeLocal(tier?.sales_end_at));
	// Unambiguous textual readbacks for the native datetime inputs; '' when the
	// value is empty or unparseable, so each hint is gated on the rendered text.
	const salesStartReadback = $derived(formatDateTimeReadback(salesStartAt));
	const salesEndReadback = $derived(formatDateTimeReadback(salesEndAt));
	let visibility = $state<'public' | 'private' | 'members-only' | 'staff-only'>(
		(tier?.visibility as 'public' | 'private' | 'members-only' | 'staff-only') ?? 'public'
	);
	let purchasableBy = $state<'public' | 'members' | 'invited' | 'invited_and_members'>(
		(tier?.purchasable_by as 'public' | 'members' | 'invited' | 'invited_and_members') ?? 'public'
	);
	let restrictedToMembershipTiersIds = $state<string[]>(
		tier?.restricted_to_membership_tiers?.map((t) => t.id).filter((id): id is string => !!id) ?? []
	);
	let restrictVisibilityToLinkedInvitations = $state(
		tier?.restrict_visibility_to_linked_invitations ?? false
	);
	let restrictPurchaseToLinkedInvitations = $state(
		tier?.restrict_purchase_to_linked_invitations ?? false
	);

	// Cancellation & refund policy state
	let allowUserCancellation = $state(tier?.allow_user_cancellation ?? false);
	let cancellationDeadlineHours = $state<number | null>(
		tier?.cancellation_deadline_hours !== null && tier?.cancellation_deadline_hours !== undefined
			? tier.cancellation_deadline_hours
			: null
	);
	let refundPolicy = $state<RefundPolicy | null>(tier?.refund_policy ?? null);
	let refundPolicyValid = $state(true);

	// Switching to a free tier removes the entire refund policy — backend ignores it.
	$effect(() => {
		if (paymentMethod === 'free' && allowUserCancellation) {
			allowUserCancellation = false;
		}
	});

	// Auto-reset restriction toggles when parent condition no longer applies
	$effect(() => {
		if (visibility !== 'private') {
			restrictVisibilityToLinkedInvitations = false;
		}
	});
	$effect(() => {
		if (purchasableBy !== 'invited' && purchasableBy !== 'invited_and_members') {
			restrictPurchaseToLinkedInvitations = false;
		}
	});

	// Venue and seating state
	let seatAssignmentMode = $state<SeatAssignmentMode>(tier?.seat_assignment_mode ?? 'none');
	let maxTicketsPerUser = $state<string>(
		tier?.max_tickets_per_user !== null && tier?.max_tickets_per_user !== undefined
			? String(tier.max_tickets_per_user)
			: ''
	);
	// Pre-fill venue: use tier's venue if editing, else fall back to event's venue
	// Venue is read-only - it always comes from the event
	const venueId = $state<string | null>(tier?.venue?.id ?? eventVenueId ?? null);

	// Check if event has a venue configured
	const hasEventVenue = $derived(!!eventVenueId);

	// Seat assignment modes other than 'none' require an event venue
	const canUseSeatAssignment = $derived(hasEventVenue);
	let sectorId = $state<string | null>(tier?.sector?.id ?? null);

	// Fetch venues for the organization (fetch when seat assignment is not 'none' OR when we have a venue pre-selected)
	const venuesQuery = createQuery<VenueDetailSchema[]>(() => ({
		queryKey: ['organization-venues', organizationSlug],
		queryFn: async () => {
			const response = await organizationadminvenuesListVenues({
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
	const sectorRequired = $derived(
		seatAssignmentMode === 'random' || seatAssignmentMode === 'user_choice'
	);
	// When sector is required, both venue and sector must be selected
	const sectorValid = $derived(!sectorRequired || (!!venueId && !!sectorId));

	// Get sectors from the selected venue
	const selectedVenueSectors = $derived.by(() => {
		if (!venueId || !venuesQuery.data) return [];
		const venue = venuesQuery.data.find((v) => v.id === venueId);
		return venue?.sectors || [];
	});

	// The venue matching the pre-filled venueId (read-only display in the seating section)
	const selectedVenue = $derived(venuesQuery.data?.find((v) => v.id === venueId));

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
	const currencySymbol = $derived(CURRENCY_SYMBOLS[currency] || currency);

	const tierCreateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierCreateSchema) =>
			eventadminticketsCreateTicketTier({
				path: { event_id: eventId },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierUpdateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierUpdateSchema) => {
			if (!tier?.id) throw new Error('Cannot update tier without an id');
			return eventadminticketsUpdateTicketTier({
				path: { event_id: eventId, tier_id: tier.id },
				body: data
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierDeleteMutation = createMutation(() => ({
		mutationFn: () => {
			if (!tier?.id) throw new Error('Cannot delete tier without an id');
			return eventadminticketsDeleteTicketTier({
				path: { event_id: eventId, tier_id: tier.id }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();

		// Determine the price value based on payment method and price type
		// Normalize all decimal values to ensure dots (not commas) as decimal separator
		let finalPrice: string;
		if (paymentMethod === 'free') {
			finalPrice = '0';
		} else if (priceType === 'pwyc') {
			// For PWYC (especially with Stripe), use minimum price as the price field
			finalPrice = normalizeDecimalInput(pwycMin || '1');
		} else {
			// Fixed price
			finalPrice = normalizeDecimalInput(price);
		}

		// Build the data object, omitting null values for pwyc fields
		const baseData: TicketTierCreateSchema = {
			name: name.trim(),
			description: description.trim() || null,
			payment_method: paymentMethod,
			price_type: priceType,
			price: finalPrice,
			currency: currency as TicketTierCreateSchema['currency'],
			manual_payment_instructions: manualPaymentInstructions.trim() || null,
			total_quantity: totalQuantity ? parseInt(totalQuantity) : null,
			sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
			sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null,
			visibility,
			purchasable_by: purchasableBy,
			restricted_to_membership_tiers_ids:
				restrictedToMembershipTiersIds.length > 0 ? restrictedToMembershipTiersIds : null,
			restrict_visibility_to_linked_invitations:
				visibility === 'private' ? restrictVisibilityToLinkedInvitations : false,
			restrict_purchase_to_linked_invitations:
				purchasableBy === 'invited' || purchasableBy === 'invited_and_members'
					? restrictPurchaseToLinkedInvitations
					: false,
			// VAT rate override (optional, cleared for free tiers)
			vat_rate:
				paymentMethod === 'free'
					? null
					: vatRateOverride !== ''
						? parseFloat(normalizeDecimalInput(vatRateOverride))
						: null,
			// Venue and seating configuration
			seat_assignment_mode: seatAssignmentMode,
			max_tickets_per_user: maxTicketsPerUser ? parseInt(maxTicketsPerUser) : null,
			venue_id: seatAssignmentMode !== 'none' ? venueId : null,
			sector_id: seatAssignmentMode !== 'none' ? sectorId : null,
			// Cancellation & refund policy (only meaningful for paid tiers)
			allow_user_cancellation: paymentMethod === 'free' ? false : allowUserCancellation,
			cancellation_deadline_hours:
				paymentMethod !== 'free' && allowUserCancellation && cancellationDeadlineHours !== null
					? cancellationDeadlineHours
					: null,
			refund_policy: paymentMethod !== 'free' && allowUserCancellation ? refundPolicy : null
		};

		// Only include pwyc fields if price_type is 'pwyc' and they have values
		if (priceType === 'pwyc') {
			if (pwycMin) {
				baseData.pwyc_min = normalizeDecimalInput(pwycMin);
			}
			if (pwycMax) {
				baseData.pwyc_max = normalizeDecimalInput(pwycMax);
			}
		}

		if (!tier) {
			// Create new tier
			tierCreateMutation.mutate(baseData);
		} else {
			// Update existing tier
			tierUpdateMutation.mutate(baseData as TicketTierUpdateSchema);
		}
	}

	function handleDelete() {
		if (!tier) return;
		if (!confirm(m['tierForm.deleteConfirm']({ name: tier.name }))) return;
		tierDeleteMutation.mutate();
	}

	const isPending = $derived(
		tierCreateMutation.isPending || tierUpdateMutation.isPending || tierDeleteMutation.isPending
	);
	const error = $derived(
		tierCreateMutation.error || tierUpdateMutation.error || tierDeleteMutation.error
	);
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
		<DialogHeader>
			<DialogTitle
				>{tier ? m['tierForm.editTicketTier']() : m['tierForm.createTicketTier']()}</DialogTitle
			>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Tier Name -->
			<div>
				<Label for="tier-name">
					{m['tierForm.tierNameLabel']()} <span class="text-destructive">*</span>
				</Label>
				<Input
					id="tier-name"
					bind:value={name}
					required
					maxlength={150}
					placeholder={m['tierForm.tierNamePlaceholder']()}
					disabled={isPending}
				/>
			</div>

			<!-- Description -->
			<div>
				<MarkdownEditor
					id="tier-description"
					label={m['tierForm.descriptionOptional']()}
					bind:value={description}
					rows={3}
					placeholder={m['tierForm.whatsIncludedPlaceholder']()}
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
						{m['tierForm.onlineStripe']()}
						{!organizationStripeConnected ? m['tierForm.notConnectedSuffix']() : ''}
					</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if paymentMethod === 'free'}
						{m['tierForm.paymentHelpFree']()}
					{:else if paymentMethod === 'offline'}
						{m['tierForm.paymentHelpOffline']()}
					{:else if paymentMethod === 'at_the_door'}
						{m['tierForm.paymentHelpAtTheDoor']()}
					{:else if paymentMethod === 'online'}
						{m['tierForm.paymentHelpOnline']()}
					{/if}
				</p>
			</div>

			<!-- Price Settings (if not free) -->
			{#if paymentMethod !== 'free'}
				<TierFormPricingSection
					bind:priceType
					bind:currency
					bind:price
					bind:pwycMin
					bind:pwycMax
					{currencySymbol}
					{isPending}
				/>
			{/if}

			<!-- VAT Rate Override (for paid tiers) -->
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
						disabled={isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['tierForm.vatRateOverrideHelp']()}
					</p>
				</div>
			{/if}

			<!-- Manual Payment Instructions (for offline/at_the_door payments) -->
			{#if paymentMethod === 'offline' || paymentMethod === 'at_the_door'}
				<div>
					<MarkdownEditor
						id="payment-instructions"
						label={m['tierForm.paymentInstructions']?.() ?? 'Payment Instructions'}
						bind:value={manualPaymentInstructions}
						rows={3}
						placeholder={m['tierForm.paymentInstructionsPlaceholder']?.() ??
							'e.g., Bank transfer to IBAN XX..., or pay in cash at the door'}
						disabled={isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['tierForm.paymentInstructionsHelp']?.() ??
							'Instructions shown to attendees after reserving their ticket'}
					</p>
				</div>
			{/if}

			<!-- Cancellation & Refunds (only for paid tiers) -->
			{#if paymentMethod !== 'free'}
				<div class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
					<div class="flex items-center gap-2 text-sm font-medium">
						<Undo2 class="h-4 w-4 text-primary" aria-hidden="true" />
						{m['refundPolicy.sectionTitle']()}
					</div>

					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							bind:checked={allowUserCancellation}
							disabled={isPending}
							class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
						/>
						<div>
							<span class="text-sm font-medium">
								{m['refundPolicy.allowCancellationLabel']()}
							</span>
							<p class="text-xs text-muted-foreground">
								{m['refundPolicy.allowCancellationHelp']()}
							</p>
						</div>
					</label>

					{#if allowUserCancellation}
						<DurationInput
							id="cancellation-deadline-hours"
							label={m['refundPolicy.deadlineLabel']()}
							helpText={m['refundPolicy.deadlineHelp']()}
							bind:value={cancellationDeadlineHours}
							storageUnit="hours"
							defaultUnit="days"
							emptyValue={null}
							emptyLabel={m['refundPolicy.deadlineNoLimit']()}
							disabled={isPending}
						/>

						<RefundPolicyEditor
							value={refundPolicy}
							disabled={isPending}
							{currencySymbol}
							onChange={(next) => (refundPolicy = next)}
							onValidityChange={(valid) => (refundPolicyValid = valid)}
						/>
					{/if}
				</div>
			{/if}

			<TierFormAvailabilitySection
				bind:totalQuantity
				bind:salesStartAt
				bind:salesEndAt
				{salesStartReadback}
				{salesEndReadback}
				bind:visibility
				bind:purchasableBy
				bind:restrictVisibilityToLinkedInvitations
				bind:restrictPurchaseToLinkedInvitations
				bind:restrictedToMembershipTiersIds
				{membershipTiers}
				{isPending}
			/>

			<TierFormSeatingSection
				bind:seatAssignmentMode
				bind:maxTicketsPerUser
				bind:sectorId
				{canUseSeatAssignment}
				{venueId}
				venuesLoading={venuesQuery.isLoading}
				{selectedVenue}
				{selectedVenueSectors}
				{sectorRequired}
				{isPending}
			/>

			<!-- Form Actions -->
			<div class="flex justify-between gap-2 border-t border-border pt-4">
				<div>
					{#if tier}
						<Button type="button" variant="destructive" onclick={handleDelete} disabled={isPending}>
							{tierDeleteMutation.isPending ? m['tierForm.deleting']() : m['tierForm.deleteTier']()}
						</Button>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button type="button" variant="outline" onclick={onClose} disabled={isPending}>
						{m['tierForm.cancel']()}
					</Button>
					<Button
						type="submit"
						disabled={isPending ||
							!name.trim() ||
							!sectorValid ||
							(paymentMethod !== 'free' && allowUserCancellation && !refundPolicyValid)}
					>
						{isPending
							? m['tierForm.saving']()
							: tier
								? m['tierForm.saveChanges']()
								: m['tierForm.createTier']()}
					</Button>
				</div>
			</div>

			{#if error}
				{@const fieldErrors = extractFieldErrors(error)}
				{@const errorMsg = extractErrorMessage(error)}
				{@const isBillingError = errorMsg.toLowerCase().includes('billing information is required')}
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
					{/if}

					{#if isBillingError}
						<a
							href={resolve('/(auth)/org/[slug]/admin/billing', { slug: organizationSlug })}
							class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-destructive underline hover:text-destructive/80"
						>
							{m['tierForm.completeBillingInfo']()}
						</a>
					{/if}
				</div>
			{/if}
		</form>
	</DialogContent>
</Dialog>
