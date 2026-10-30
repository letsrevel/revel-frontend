<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminticketsCreateTicketTier,
		eventadminticketsUpdateTicketTier,
		eventadminticketsDeleteTicketTier,
		organizationadminvenuesListVenues,
		eventpublicseatingGetChart
	} from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierCreateSchema,
		TicketTierUpdateSchema,
		MembershipTierSchema,
		VenueDetailSchema,
		VenueChartSchema,
		SeatAssignmentMode,
		RefundPolicy
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import TierFormPricingSection from './TierFormPricingSection.svelte';
	import TierFormAvailabilitySection from './TierFormAvailabilitySection.svelte';
	import TierFormSeatingSection from './TierFormSeatingSection.svelte';
	import TierFormCheckInSection from './TierFormCheckInSection.svelte';
	import TierFormCancellationSection from './TierFormCancellationSection.svelte';
	import TierFormPaymentMethodSection from './TierFormPaymentMethodSection.svelte';
	import TierFormErrorPanel from './TierFormErrorPanel.svelte';
	import TierFormVatSection from './TierFormVatSection.svelte';
	import {
		omitUnchangedZeroRuleFields,
		zeroRuleRechecked,
		exemptionLikelyCause,
		exemptionReasonForPayload,
		payloadPrice,
		vatExemptionRequired,
		type OrgVatContext
	} from './tier-vat';
	import {
		checkInOffsetsPayload,
		checkInPicksValid,
		initialCheckInPicks,
		type TierCheckInEventContext
	} from './check-in-offset';
	import { authStore } from '$lib/stores/auth.svelte';
	import { markSilent } from '$lib/utils/errors';
	import { CURRENCY_SYMBOLS, toTimezoneAwareISO, normalizeDecimalInput } from './tier-form-helpers';
	import {
		buildCategoryPricesPayload,
		buildTierSeatingFields,
		retainedSectorIdForMode
	} from './tier-seating-payload';
	import type { EventRules } from '$lib/utils/compliance';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import type { PlatformFeeConfig, PlatformFeeInfo } from '$lib/utils/fees';
	import { stashTierDraft, stripeGateFor, tierSeed, type TierDraft } from './tier-draft';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new
		eventId: string;
		organizationSlug: string;
		organizationStripeConnected: boolean;
		/** Connected, but billing details are missing (see billingNeedsAttention). */
		billingNeedsAttention?: boolean;
		/** Prefill for the Stripe onboarding email. */
		stripeEmail?: string;
		isOwner?: boolean;
		draft?: TierDraft | null;
		/** Org platform-fee terms for the net-payout preview (null hides it). */
		platformFees?: PlatformFeeInfo | null;
		feeConfig: PlatformFeeConfig;
		membershipTiers?: MembershipTierSchema[];
		eventVenueId?: string | null; // Pre-fill venue from event
		eventCapacity?: number | null; // Effective event cap (null = uncapped)
		/** The event form's start/end/check-in window the tier offsets are relative to. */
		eventContext?: TierCheckInEventContext;
		/** The event's country rules (#1001) and whether they've loaded (fails closed). */
		rules?: EventRules;
		/** Org VAT defaults (rate, invoicing mode, exemption reason); null/absent = unknown. */
		orgVat?: OrgVatContext | null;
		onClose: () => void;
	}

	const {
		tier,
		eventId,
		organizationSlug,
		organizationStripeConnected,
		billingNeedsAttention = false,
		stripeEmail = '',
		isOwner = false,
		draft = null,
		platformFees = null,
		feeConfig,
		membershipTiers = [],
		eventVenueId = null,
		eventCapacity = null,
		eventContext = { start: '' },
		rules = { compliance: null, status: 'ready' },
		orgVat = null,
		onClose
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	const seed = tierSeed(tier, draft);
	let name = $state(seed.name);
	let description = $state(seed.description);
	let paymentMethod = $state(seed.paymentMethod);
	let priceType = $state(seed.priceType);
	let price = $state(seed.price);
	let pwycMin = $state(seed.pwycMin);
	let pwycMax = $state(seed.pwycMax);
	let currency = $state(seed.currency);
	let vatRateOverride = $state(seed.vatRateOverride);
	let vatExemptionReason = $state(seed.vatExemptionReason ?? '');
	let failedExemptionCause = $state(false);
	let vatReasonError = $state('');
	let manualPaymentInstructions = $state(seed.manualPaymentInstructions);
	let totalQuantity = $state(seed.totalQuantity);
	let salesStartAt = $state(seed.salesStartAt);
	let salesEndAt = $state(seed.salesEndAt);
	let salesPaused = $state(tier?.sales_paused ?? false);
	// Per-tier check-in window (#945): picked times ↔ offsets from event start.
	const checkInPicks = $state(initialCheckInPicks(eventContext.start, tier));
	// Unambiguous textual readbacks for the native datetime inputs; '' when the
	// value is empty or unparseable, so each hint is gated on the rendered text.
	const salesStartReadback = $derived(formatDateTimeReadback(salesStartAt));
	const salesEndReadback = $derived(formatDateTimeReadback(salesEndAt));
	let visibility = $state(seed.visibility);
	let purchasableBy = $state(seed.purchasableBy);
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

	// New tiers: until the organizer touches the checkbox, the default follows the
	// payment method (free -> on, paid -> off) so a paid tier never silently
	// inherits "on" with no refund policy. Editing keeps the stored value.
	let cancellationTouched = $state(false);
	$effect(() => {
		if (!tier && !cancellationTouched) {
			allowUserCancellation = paymentMethod === 'free';
		}
	});

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
	let maxTicketsPerUser = $state(seed.maxTicketsPerUser);
	// Pre-fill venue: use tier's venue if editing, else fall back to event's venue
	// Venue is read-only - it always comes from the event
	const venueId = $state<string | null>(tier?.venue?.id ?? eventVenueId ?? null);

	// Check if event has a venue configured
	const hasEventVenue = $derived(!!eventVenueId);

	// Seat assignment modes other than 'none' require an event venue
	const canUseSeatAssignment = $derived(hasEventVenue);
	let sectorId = $state<string | null>(tier?.sector?.id ?? null);

	// Per-category prices — the single pricing mechanism for BOTH seated modes
	// (pricing convergence). The baseline is what the server stored; the payload
	// builder sends the map ONLY when it diverges from this (PUT + three-way
	// write semantics: omit = untouched, {} = clear, non-empty = replace), so an
	// unrelated edit can't wipe prices.
	const initialCategoryPrices: Record<string, string> = Object.fromEntries(
		Object.entries(tier?.category_prices ?? {}).map(([id, value]) => [id, String(value)])
	);
	let categoryPrices = $state<Record<string, string>>({ ...initialCategoryPrices });

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

	// Fetch the venue seating chart — price categories only exist on the chart.
	// Public endpoint; the Bearer header lets admins of draft/private events resolve it.
	const chartQuery = createQuery<VenueChartSchema>(() => ({
		queryKey: ['seating-chart', eventId],
		queryFn: async () => {
			const response = await eventpublicseatingGetChart({
				path: { event_id: eventId },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});

			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load seating chart');
			}

			return response.data;
		},
		enabled: !!venueId
	}));

	// A seated tier of EITHER mode requires a sector (pricing convergence: the
	// removed price-category FK used to supply the venue for best_available).
	const sectorRequired = $derived(seatAssignmentMode !== 'none');
	// When sector is required, both venue and sector must be selected
	const sectorValid = $derived(!sectorRequired || (!!venueId && !!sectorId));

	const priceCategories = $derived(chartQuery.data?.price_categories ?? []);

	// Standing sectors can't back a user_choice tier — their "spots" are never
	// holdable server-side. VenueSectorSchema has no `kind`, so join against the
	// chart (which does) to know which sectors to hide from the picker.
	const standingSectorIds = $derived(
		new Set((chartQuery.data?.sectors ?? []).filter((s) => s.kind === 'standing').map((s) => s.id))
	);

	// Get sectors from the selected venue (minus standing ones once the chart is loaded)
	const selectedVenueSectors = $derived.by(() => {
		if (!venueId || !venuesQuery.data) return [];
		const venue = venuesQuery.data.find((v) => v.id === venueId);
		const sectors = venue?.sectors || [];
		if (standingSectorIds.size === 0) return sectors;
		return sectors.filter((s) => !s.id || !standingSectorIds.has(s.id));
	});

	// The inverse pool: standing sectors CAN back a GA (none) tier — linking one
	// turns its capacity into a hard sale-time cap. Empty until the chart loads.
	const standingVenueSectors = $derived.by(() => {
		if (!venueId || !venuesQuery.data) return [];
		const venue = venuesQuery.data.find((v) => v.id === venueId);
		return (venue?.sectors || []).filter((s) => !!s.id && standingSectorIds.has(s.id));
	});

	// The venue matching the pre-filled venueId (read-only display in the seating section)
	const selectedVenue = $derived(venuesQuery.data?.find((v) => v.id === venueId));

	// Keep the sector consistent with venue, mode and sector kind: standing
	// sectors are only valid on GA (none) tiers, seated ones on user_choice.
	// Only clear once venues AND the chart are loaded — standing-ness comes from
	// the chart — so the edit-mode prefill (incl. a GA tier's standing sector)
	// survives the fetches.
	$effect(() => {
		if (!venueId) {
			sectorId = null;
			return;
		}
		if (sectorId === null || !venuesQuery.data || !chartQuery.data) return;
		const retained = retainedSectorIdForMode(seatAssignmentMode, sectorId, standingSectorIds);
		if (retained !== sectorId) {
			sectorId = retained;
			return;
		}
		// Sector must still belong to the current venue.
		const pool = seatAssignmentMode === 'none' ? standingVenueSectors : selectedVenueSectors;
		if (!pool.some((s) => s.id === sectorId)) {
			sectorId = null;
		}
	});

	// Categories offered in the pricing editor (both seated modes): those
	// painted on an active seat of the selected sector, plus any category the
	// tier already prices (stale extras stay editable/clearable instead of
	// vanishing). On user_choice a non-empty map must cover every painted
	// category; on best_available the priced subset DEFINES the sellable zones.
	const sectorPricingCategories = $derived.by(() => {
		if (seatAssignmentMode === 'none' || !sectorId || !chartQuery.data) return [];
		const sector = (chartQuery.data.sectors ?? []).find((s) => s.id === sectorId);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: built fresh per derivation and consumed synchronously
		const painted = new Set<string>();
		for (const seat of sector?.seats ?? []) {
			if (seat.is_active !== false && seat.price_category_id) {
				painted.add(seat.price_category_id);
			}
		}
		return priceCategories.filter(
			(category) =>
				!!category.id && (painted.has(category.id) || (categoryPrices[category.id] ?? '') !== '')
		);
	});

	const currencySymbol = $derived(CURRENCY_SYMBOLS[currency] || currency);

	// The generated client resolves with `{ error }` on HTTP errors instead of
	// rejecting (ThrowOnError = false), so each mutationFn must throw the error
	// body itself — otherwise a 400/422 lands in onSuccess and closes the dialog
	// without ever showing the error panel below. `markSilent` keeps the global
	// "Action failed" toast from duplicating that panel (the RefundTicketDialog
	// convention); the body is thrown unwrapped so extractFieldErrors still
	// sees the pydantic detail array.
	// Last save's HTTP status: a plain-detail 422 is a country-rule refusal (#1001).
	let saveStatus = $state<number | undefined>(undefined);

	const tierCreateMutation = createMutation(() => ({
		mutationFn: async (data: TicketTierCreateSchema) => {
			const res = await eventadminticketsCreateTicketTier({
				path: { event_id: eventId },
				body: data
			});
			saveStatus = res.response?.status;
			if (res.error) throw markSilent(res.error);
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierUpdateMutation = createMutation(() => ({
		mutationFn: async (data: TicketTierUpdateSchema) => {
			if (!tier?.id) throw new Error('Cannot update tier without an id');
			const res = await eventadminticketsUpdateTicketTier({
				path: { event_id: eventId, tier_id: tier.id },
				body: data
			});
			saveStatus = res.response?.status;
			if (res.error) throw markSilent(res.error);
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierDeleteMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!tier?.id) throw new Error('Cannot delete tier without an id');
			const res = await eventadminticketsDeleteTicketTier({
				path: { event_id: eventId, tier_id: tier.id }
			});
			if (res.error) throw markSilent(res.error);
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	// Card + unknown rules: hold the save. Known-blocked legacy card tiers still save (J29.3).
	const onlineSaveHeld = $derived(rules.status !== 'ready' && paymentMethod === 'online');
	// The section's Stripe / tax-details gate also holds the save.
	const stripeGate = $derived(
		stripeGateFor(
			paymentMethod,
			rules.status !== 'ready' || rules.compliance?.online_payment === 'blocked',
			organizationStripeConnected,
			billingNeedsAttention
		)
	);
	// The exemption reason is mandatory for online-paid, 0%-VAT tiers when the org invoices
	// and has no default reason (mirrors the backend 422).
	// On edit it only applies when a rule field changed vs the saved tier (backend carve-out).
	// The reason is taken as the payload carries it, so omission compares like with like.
	const zeroRuleInputs = $derived({
		paymentMethod,
		priceType,
		price: payloadPrice(paymentMethod, priceType, price, pwycMin),
		pwycMin,
		pwycMax,
		vatRateOverride,
		vatExemptionReason: exemptionReasonForPayload(
			paymentMethod,
			vatRateOverride,
			vatExemptionReason
		)
	});
	const vatPriceInputs = $derived({
		...zeroRuleInputs,
		price,
		categoryPrices: seatAssignmentMode === 'none' ? [] : Object.values(categoryPrices)
	});
	const categoryPricesPayload = $derived(
		buildCategoryPricesPayload(seatAssignmentMode, initialCategoryPrices, categoryPrices)
	);
	const vatReasonRequired = $derived(
		zeroRuleRechecked(tier, zeroRuleInputs, salesPaused, categoryPricesPayload !== undefined) &&
			vatExemptionRequired(vatPriceInputs, vatRateOverride, orgVat)
	);
	// Clear a shown error as soon as it no longer applies (reason typed or no longer required).
	$effect(() => {
		if (vatReasonError && (!vatReasonRequired || vatExemptionReason.trim())) vatReasonError = '';
	});
	const saveHeld = $derived(onlineSaveHeld || stripeGate !== null);
	const heldBy = $derived(
		onlineSaveHeld ? 'tier-online-blocked' : stripeGate && 'tier-stripe-gate'
	);

	function stashDraft(): void {
		stashTierDraft(eventId, {
			tierId: tier?.id ?? null,
			name,
			description,
			paymentMethod,
			priceType,
			price,
			pwycMin,
			pwycMax,
			currency,
			vatRateOverride,
			vatExemptionReason,
			manualPaymentInstructions,
			totalQuantity,
			salesStartAt,
			salesEndAt,
			maxTicketsPerUser,
			visibility,
			purchasableBy
		});
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (saveHeld) return;

		if (vatReasonRequired && !vatExemptionReason.trim()) {
			vatReasonError = m['tierForm.vatExemptionReasonRequired']();
			void tick().then(() => document.getElementById('vat-exemption-reason')?.focus());
			return;
		}
		vatReasonError = '';

		const finalPrice = payloadPrice(paymentMethod, priceType, price, pwycMin);

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
			sales_paused: salesPaused,
			...checkInOffsetsPayload(eventContext.start, checkInPicks, tier),
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
			vat_exemption_reason: zeroRuleInputs.vatExemptionReason,
			// Venue and seating configuration
			seat_assignment_mode: seatAssignmentMode,
			max_tickets_per_user: maxTicketsPerUser ? parseInt(maxTicketsPerUser) : null,
			// Per-mode venue/sector nulling mirrors server validation
			// (see tier-seating-payload.ts).
			...buildTierSeatingFields(seatAssignmentMode, venueId, sectorId),
			// Cancellation applies to every payment method; the refund policy is
			// meaningless for free tiers, so it is only sent for paid ones.
			allow_user_cancellation: allowUserCancellation,
			cancellation_deadline_hours:
				allowUserCancellation && cancellationDeadlineHours !== null
					? cancellationDeadlineHours
					: null,
			refund_policy: paymentMethod !== 'free' && allowUserCancellation ? refundPolicy : null
		};

		// Sent ONLY when dirty (omit = leave the stored map untouched, {} =
		// clear, non-empty = replace) — see buildCategoryPricesPayload.
		if (categoryPricesPayload !== undefined) {
			baseData.category_prices = categoryPricesPayload;
		}

		// Only include pwyc fields if price_type is 'pwyc' and they have values
		if (priceType === 'pwyc') {
			if (pwycMin) {
				baseData.pwyc_min = normalizeDecimalInput(pwycMin);
			}
			if (pwycMax) {
				baseData.pwyc_max = normalizeDecimalInput(pwycMax);
			}
		}

		if (tier) {
			// The backend enforces the zero-rate rule whenever any rule key is PRESENT, so
			// send only the ones that changed: renaming a legacy 0% tier must still save.
			omitUnchangedZeroRuleFields(tier, baseData, zeroRuleInputs);
		}

		// Frozen now: the error panel must not re-evaluate it as the user keeps typing.
		failedExemptionCause = exemptionLikelyCause(vatPriceInputs, orgVat);
		if (!tier) {
			tierCreateMutation.mutate(baseData);
		} else {
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

			<TierFormPaymentMethodSection
				bind:paymentMethod
				{isPending}
				{organizationStripeConnected}
				{billingNeedsAttention}
				{organizationSlug}
				{eventId}
				{stripeEmail}
				{isOwner}
				onBeforeStripeConnect={stashDraft}
				compliance={rules.compliance}
				complianceStatus={rules.status}
				onRetryCompliance={rules.onRetry}
			/>

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
					{platformFees}
					{feeConfig}
					showNetPayout={paymentMethod === 'online'}
				/>
			{/if}

			<TierFormVatSection
				{paymentMethod}
				bind:vatRateOverride
				bind:vatExemptionReason
				{orgVat}
				required={vatReasonRequired}
				error={vatReasonError}
				{isPending}
			/>

			<!-- Manual Payment Instructions (for offline/at_the_door payments) -->
			{#if paymentMethod === 'offline' || paymentMethod === 'at_the_door'}
				<div>
					<MarkdownEditor
						id="payment-instructions"
						label={m['tierForm.paymentInstructions']()}
						bind:value={manualPaymentInstructions}
						rows={3}
						placeholder={m['tierForm.paymentInstructionsPlaceholder']()}
						disabled={isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['tierForm.paymentInstructionsHelp']()}
					</p>
				</div>
			{/if}

			<TierFormCancellationSection
				{paymentMethod}
				bind:allowUserCancellation
				bind:cancellationDeadlineHours
				bind:refundPolicy
				{currencySymbol}
				{isPending}
				onToggle={() => (cancellationTouched = true)}
				onValidityChange={(valid) => (refundPolicyValid = valid)}
			/>

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
				bind:salesPaused
				{eventCapacity}
				{isPending}
			/>

			<TierFormCheckInSection
				bind:opensAt={checkInPicks.opensAt}
				bind:closesAt={checkInPicks.closesAt}
				{eventContext}
				{isPending}
			/>

			<TierFormSeatingSection
				bind:seatAssignmentMode
				bind:maxTicketsPerUser
				bind:sectorId
				bind:categoryPrices
				pricingCategories={sectorPricingCategories}
				pricingGaps={tier?.pricing_gaps ?? []}
				unsellableZones={tier?.unsellable_zones ?? []}
				{currencySymbol}
				{canUseSeatAssignment}
				{venueId}
				venuesLoading={venuesQuery.isLoading}
				{selectedVenue}
				{selectedVenueSectors}
				standingSectors={standingVenueSectors}
				{sectorRequired}
				chartLoading={chartQuery.isLoading}
				chartError={chartQuery.isError}
				onRetryChart={() => chartQuery.refetch()}
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
							saveHeld ||
							!name.trim() ||
							!sectorValid ||
							!checkInPicksValid(eventContext.start, checkInPicks) ||
							(paymentMethod !== 'free' && allowUserCancellation && !refundPolicyValid)}
						aria-describedby={heldBy || undefined}
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
				<TierFormErrorPanel
					{error}
					{saveStatus}
					{paymentMethod}
					{organizationSlug}
					exemptionLikelyCause={failedExemptionCause}
				/>
			{/if}
		</form>
	</DialogContent>
</Dialog>
