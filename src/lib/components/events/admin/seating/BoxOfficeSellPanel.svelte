<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { tick } from 'svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		eventadminseatingBoxOfficeSell,
		eventadminticketsListTicketTiers,
		eventpublicseatingGetAvailability,
		eventpublicseatingGetChart
	} from '$lib/api';
	import type {
		AdminTicketSchema,
		BoxOfficeSellRequest,
		SeatingAvailabilitySchema,
		TicketTierDetailSchema,
		VenueChartSchema
	} from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { AlertCircle, LoaderCircle } from '@lucide/svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { formatMoney } from '$lib/utils/format';
	import { extractPurchaseErrorMessage } from '$lib/components/tickets/purchase-error';
	import type { SeatView } from '$lib/components/tickets/seating-view';
	import { seatViewsFrom, sectorGroupsFrom } from './seat-override-model';
	import BoxOfficeSeatPicker from './BoxOfficeSeatPicker.svelte';
	import {
		BOX_OFFICE_PAYMENT_METHODS,
		boxOfficePaymentMethodLabel,
		buildSellRequest,
		doorSalePrice,
		isSellableStatus,
		recordedSaleAmount,
		seatPriceCategoryId,
		seatSectorId,
		tiersForSeat,
		type BoxOfficePaymentMethod
	} from './box-office-model';

	interface Props {
		eventId: string;
		accessToken: string | null;
	}

	const { eventId, accessToken }: Props = $props();

	const queryClient = useQueryClient();
	const CHART_STALE_TIME_MS = 5 * 60 * 1000;

	const chartQuery = createQuery<VenueChartSchema | null, Error>(() => ({
		queryKey: ['seating-chart', eventId],
		staleTime: CHART_STALE_TIME_MS,
		queryFn: async () => {
			const response = await eventpublicseatingGetChart({ path: { event_id: eventId } });
			if (response.response?.status === 404) return null;
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load seating chart');
			}
			return response.data;
		}
	}));

	const availabilityQuery = createQuery<SeatingAvailabilitySchema, Error>(() => ({
		queryKey: ['seating-availability', eventId],
		queryFn: async () => {
			const response = await eventpublicseatingGetAvailability({ path: { event_id: eventId } });
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load seat availability');
			}
			return response.data;
		}
	}));

	const tiersQuery = createQuery<TicketTierDetailSchema[], Error>(() => ({
		queryKey: ['event-admin-tiers', eventId],
		enabled: !!accessToken,
		queryFn: async () => {
			const response = await eventadminticketsListTicketTiers({
				path: { event_id: eventId },
				query: { page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load ticket tiers');
			}
			return response.data.results ?? [];
		}
	}));

	const isLoading = $derived.by(() => {
		const chartPending = chartQuery.isPending;
		const availabilityPending = availabilityQuery.isPending;
		const tiersPending = tiersQuery.isPending;
		return chartPending || availabilityPending || tiersPending;
	});
	const isError = $derived.by(() => {
		const chartError = chartQuery.isError;
		const availabilityError = availabilityQuery.isError;
		const tiersError = tiersQuery.isError;
		return chartError || availabilityError || tiersError;
	});

	const chart = $derived(chartQuery.data ?? null);
	const availability = $derived(availabilityQuery.data ?? null);
	const tiers = $derived(tiersQuery.data ?? []);
	const hasSeating = $derived(chart !== null && (chart.sectors ?? []).length > 0);

	const groups = $derived(chart && availability ? sectorGroupsFrom(chart, availability) : []);
	const allSeats = $derived(seatViewsFrom(groups));

	// Form state
	let selectedSeatId = $state<string | null>(null);
	let selectedTierId = $state<string | null>(null);
	let email = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let paymentMethod = $state<BoxOfficePaymentMethod>('at_the_door');

	const selectedSeat = $derived(allSeats.find((seat) => seat.id === selectedSeatId) ?? null);

	const availableTiers = $derived.by(() => {
		if (!chart || !selectedSeatId) return tiersForSeat(tiers, null);
		return tiersForSeat(tiers, {
			sectorId: seatSectorId(chart, selectedSeatId),
			categoryId: seatPriceCategoryId(chart, selectedSeatId)
		});
	});

	// Keep the tier selection valid for the chosen seat.
	$effect(() => {
		const ids = availableTiers.map((tier) => tier.id);
		if (selectedTierId && !ids.includes(selectedTierId)) {
			selectedTierId = null;
		}
	});

	const selectedTier = $derived(availableTiers.find((tier) => tier.id === selectedTierId) ?? null);

	const compLabel = $derived(
		m['orgAdmin.seating.boxOffice.amountComp']?.() ?? 'Free / comp — nothing to collect'
	);

	/**
	 * What door staff must collect for the current seat + tier (#958). The
	 * backend records exactly this amount, so the drawer must match it.
	 * `unpriced` = the tier doesn't price the seat's category (sale refused).
	 */
	const amountToCollect = $derived.by((): { text: string; unpriced: boolean } | null => {
		if (!chart || !selectedSeatId || !selectedTier) return null;
		if (paymentMethod === 'free') return { text: compLabel, unpriced: false };
		const price = doorSalePrice(selectedTier, seatPriceCategoryId(chart, selectedSeatId));
		if (price === null) {
			return {
				text:
					m['orgAdmin.seating.boxOffice.amountUnpriced']?.() ??
					"This tier doesn't price this seat's category, so it can't be sold here.",
				unpriced: true
			};
		}
		return { text: formatMoney(price, selectedTier.currency), unpriced: false };
	});

	const requestBody = $derived(
		buildSellRequest({
			seatId: selectedSeatId,
			tierId: selectedTierId,
			paymentMethod,
			email,
			firstName,
			lastName
		})
	);

	function isSelectable(seat: SeatView): boolean {
		return isSellableStatus(seat.status);
	}

	// Result reporting
	let lastResult = $state<AdminTicketSchema | null>(null);
	let resultEl = $state<HTMLDivElement | null>(null);

	/** The amount the backend recorded for the last sale (#958). */
	const lastResultAmount = $derived.by(() => {
		if (!lastResult) return null;
		if (lastResult.sale_source === 'box_office_comp') return compLabel;
		return formatMoney(recordedSaleAmount(lastResult), lastResult.tier.currency);
	});

	const sellMutation = createMutation(() => ({
		mutationFn: async (body: BoxOfficeSellRequest): Promise<AdminTicketSchema> => {
			const response = await eventadminseatingBoxOfficeSell({
				path: { event_id: eventId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error !== undefined || !response.data) {
				throw response.error ?? new Error('Box office sell failed');
			}
			return response.data;
		},
		onSuccess: async (ticket: AdminTicketSchema) => {
			lastResult = ticket;
			const seatLabel = ticket.seat?.label ?? selectedSeat?.label ?? '';
			toast.success(
				m['orgAdmin.seating.boxOffice.sellSuccessToast']?.({
					seat: seatLabel,
					recipient: getUserDisplayName(ticket.user)
				}) ?? `Ticket issued on seat ${seatLabel}`
			);
			// Reset for the next sale (keep the payment method for repeated door sales).
			selectedSeatId = null;
			selectedTierId = null;
			email = '';
			firstName = '';
			lastName = '';
			queryClient.invalidateQueries({ queryKey: ['seating-availability', eventId] });
			await tick();
			resultEl?.focus();
		},
		onError: (err: unknown) => {
			// Clear any prior success box so a failed sale can't read as issued.
			lastResult = null;
			toast.error(
				extractPurchaseErrorMessage(
					err,
					m['orgAdmin.seating.boxOffice.sellFailedToast']?.() ?? 'Failed to issue the ticket'
				)
			);
		}
	}));

	function submit(): void {
		if (!requestBody || sellMutation.isPending) return;
		sellMutation.mutate(requestBody);
	}

	const submitDisabled = $derived.by(() => {
		const pending = sellMutation.isPending;
		// An unpriced seat would be refused server-side; a comp still goes through.
		return requestBody === null || pending || !accessToken || !!amountToCollect?.unpriced;
	});
</script>

<div class="space-y-6">
	{#if isLoading}
		<div class="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
			<LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['orgAdmin.seating.loading']()}
		</div>
	{:else if isError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<span>{m['orgAdmin.seating.loadError']()}</span>
		</div>
	{:else if !hasSeating}
		<div class="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
			{m['orgAdmin.seating.noSeating']()}
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">
			{m['orgAdmin.seating.boxOffice.sellIntro']?.() ??
				'Issue a ticket directly on a seat for a walk-up or comped guest.'}
		</p>

		{#if lastResult}
			<div
				bind:this={resultEl}
				tabindex="-1"
				class="rounded-lg border border-success/40 bg-success/10 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				role="status"
			>
				<h3 class="text-sm font-semibold">
					{m['orgAdmin.seating.boxOffice.resultHeading']?.() ?? 'Ticket issued'}
				</h3>
				<p class="mt-1 text-sm">
					{m['orgAdmin.seating.boxOffice.resultDetail']?.({
						seat: lastResult.seat?.label ?? '',
						recipient: getUserDisplayName(lastResult.user)
					}) ?? `Seat ${lastResult.seat?.label ?? ''} — ${getUserDisplayName(lastResult.user)}`}
				</p>
				{#if lastResultAmount}
					<p class="mt-1 text-sm font-semibold" data-testid="box-office-result-amount">
						{m['orgAdmin.seating.boxOffice.resultAmount']?.({ amount: lastResultAmount }) ??
							`Recorded: ${lastResultAmount}`}
					</p>
				{/if}
			</div>
		{/if}

		<form
			class="space-y-5"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<!-- Step 1: seat -->
			<fieldset class="space-y-2">
				<legend class="text-sm font-semibold">
					{m['orgAdmin.seating.boxOffice.stepSeat']?.() ?? '1. Choose a seat'}
				</legend>
				<div class="max-h-[45vh] overflow-y-auto rounded-lg border border-border p-4">
					<BoxOfficeSeatPicker
						{groups}
						bind:selectedSeatId
						{isSelectable}
						name="box-office-seat"
						disabled={sellMutation.isPending}
					/>
				</div>
			</fieldset>

			<!-- Step 2: tier -->
			<div class="flex flex-col gap-1">
				<label for="box-office-tier" class="text-sm font-semibold">
					{m['orgAdmin.seating.boxOffice.stepTier']?.() ?? '2. Ticket tier'}
				</label>
				<select
					id="box-office-tier"
					class="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
					value={selectedTierId ?? ''}
					disabled={!selectedSeatId || sellMutation.isPending}
					onchange={(e) => (selectedTierId = e.currentTarget.value || null)}
				>
					<option value="" disabled>
						{m['orgAdmin.seating.boxOffice.tierPlaceholder']?.() ?? 'Select a tier…'}
					</option>
					{#each availableTiers as tier (tier.id)}
						<option value={tier.id}>{tier.name}</option>
					{/each}
				</select>
				{#if selectedSeatId && availableTiers.length === 0}
					<p class="text-xs text-destructive">
						{m['orgAdmin.seating.boxOffice.noTiers']?.() ??
							'No seated tier is available for this seat.'}
					</p>
				{/if}
			</div>

			<!-- Step 3: recipient -->
			<fieldset class="space-y-3">
				<legend class="text-sm font-semibold">
					{m['orgAdmin.seating.boxOffice.stepRecipient']?.() ?? '3. Recipient'}
				</legend>
				<div class="flex flex-col gap-1">
					<label for="box-office-email" class="text-xs font-medium text-muted-foreground">
						{m['orgAdmin.seating.boxOffice.emailLabel']?.() ??
							"Recipient email — we'll create a guest account or use their existing one"}
					</label>
					<Input
						id="box-office-email"
						type="email"
						bind:value={email}
						autocomplete="off"
						required
						disabled={sellMutation.isPending}
						placeholder={m['orgAdmin.seating.boxOffice.emailPlaceholder']?.() ??
							'guest@example.com'}
					/>
				</div>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div class="flex flex-col gap-1">
						<label for="box-office-first" class="text-xs font-medium text-muted-foreground">
							{m['orgAdmin.seating.boxOffice.firstNameLabel']?.() ?? 'First name (optional)'}
						</label>
						<Input
							id="box-office-first"
							type="text"
							bind:value={firstName}
							autocomplete="off"
							disabled={sellMutation.isPending}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="box-office-last" class="text-xs font-medium text-muted-foreground">
							{m['orgAdmin.seating.boxOffice.lastNameLabel']?.() ?? 'Last name (optional)'}
						</label>
						<Input
							id="box-office-last"
							type="text"
							bind:value={lastName}
							autocomplete="off"
							disabled={sellMutation.isPending}
						/>
					</div>
				</div>
			</fieldset>

			<!-- Step 4: payment method -->
			<fieldset>
				<legend class="text-sm font-semibold">
					{m['orgAdmin.seating.boxOffice.stepPayment']?.() ?? '4. Payment'}
				</legend>
				<div class="mt-1.5 flex flex-col gap-2 sm:flex-row sm:gap-4">
					{#each BOX_OFFICE_PAYMENT_METHODS as method (method)}
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="box-office-payment"
								value={method}
								checked={paymentMethod === method}
								disabled={sellMutation.isPending}
								onchange={() => (paymentMethod = method)}
								class="h-4 w-4 accent-primary"
							/>
							<span class="font-medium">{boxOfficePaymentMethodLabel(method)}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<!-- Live so door staff hear the amount change as they pick seat/tier/method. -->
				<div aria-live="polite" class="min-h-5">
					{#if amountToCollect}
						{#if amountToCollect.unpriced}
							<p class="text-sm text-destructive" data-testid="box-office-amount">
								{amountToCollect.text}
							</p>
						{:else}
							<div data-testid="box-office-amount">
								<p class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
									{m['orgAdmin.seating.boxOffice.amountLabel']?.() ?? 'Amount to collect'}
								</p>
								<p class="text-lg font-bold">{amountToCollect.text}</p>
							</div>
						{/if}
					{/if}
				</div>
				<Button type="submit" disabled={submitDisabled}>
					{#if sellMutation.isPending}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['orgAdmin.seating.boxOffice.submit']?.() ?? 'Issue ticket'}
				</Button>
			</div>
		</form>
	{/if}
</div>
