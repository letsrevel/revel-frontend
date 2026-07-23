<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		eventadminseatingApplyOverrides,
		eventpublicseatingGetAvailability,
		eventpublicseatingGetChart
	} from '$lib/api';
	import type {
		SeatOverridesRequest,
		SeatOverridesResponse,
		SeatingAvailabilitySchema,
		VenueChartSchema
	} from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { AlertCircle, LoaderCircle } from '@lucide/svelte';
	import SeatOverrideSectorList from './SeatOverrideSectorList.svelte';
	import {
		HOLD_KINDS,
		blockedSeatIdsFrom,
		buildOverridesRequest,
		holdKindLabel,
		rejectedEntriesFrom,
		seatViewsFrom,
		sectorGroupsFrom,
		type HoldKind,
		type OverrideAction,
		type RejectedEntry
	} from './seat-override-model';

	interface Props {
		eventId: string;
		accessToken: string | null;
	}

	const { eventId, accessToken }: Props = $props();

	const queryClient = useQueryClient();

	const CHART_STALE_TIME_MS = 5 * 60 * 1000;

	// Chart 404 means "event has no seated venue" — surfaced as data: null so it
	// renders as an empty state instead of an error.
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

	// $derived.by reading all operands (tracked-props || freeze trap).
	const isLoading = $derived.by(() => {
		const chartPending = chartQuery.isPending;
		const availabilityPending = availabilityQuery.isPending;
		return chartPending || availabilityPending;
	});
	const isError = $derived.by(() => {
		const chartError = chartQuery.isError;
		const availabilityError = availabilityQuery.isError;
		return chartError || availabilityError;
	});

	const chart = $derived(chartQuery.data ?? null);
	const availability = $derived(availabilityQuery.data ?? null);
	const hasSeating = $derived(chart !== null && (chart.sectors ?? []).length > 0);

	const groups = $derived(chart && availability ? sectorGroupsFrom(chart, availability) : []);
	const allSeats = $derived(seatViewsFrom(groups));
	const blockedIds = $derived(blockedSeatIdsFrom(allSeats));
	const blockedSeats = $derived(allSeats.filter((seat) => seat.status === 'blocked'));
	const labelBySeatId = $derived(new Map(allSeats.map((seat) => [seat.id, seat.label])));

	// Selection + form state
	const selected = new SvelteSet<string>();
	let action = $state<OverrideAction>('hold');
	let holdKind = $state<HoldKind>('house');
	let reason = $state('');

	const selectedCount = $derived(selected.size);
	const selectedBlockedCount = $derived([...selected].filter((id) => blockedIds.has(id)).length);

	const requestBody = $derived(
		buildOverridesRequest({
			action,
			holdKind,
			reason,
			selectedSeatIds: [...selected],
			blockedSeatIds: blockedIds
		})
	);

	function onSetSeats(seatIds: string[], checked: boolean): void {
		for (const id of seatIds) {
			if (checked) {
				selected.add(id);
			} else {
				selected.delete(id);
			}
		}
	}

	function clearSelection(): void {
		selected.clear();
	}

	// Result reporting
	interface ApplyResult {
		applied: number;
		released: number;
		rejected: RejectedEntry[];
	}
	let lastResult = $state<ApplyResult | null>(null);
	let resultsEl = $state<HTMLDivElement | null>(null);

	const applyMutation = createMutation(() => ({
		mutationFn: async (body: SeatOverridesRequest): Promise<SeatOverridesResponse> => {
			const response = await eventadminseatingApplyOverrides({
				path: { event_id: eventId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to apply seat overrides');
			}
			return response.data;
		},
		onSuccess: async (data: SeatOverridesResponse) => {
			const applied = data.applied ?? 0;
			const released = data.released ?? 0;
			lastResult = {
				applied,
				released,
				rejected: rejectedEntriesFrom(data.rejected, labelBySeatId)
			};
			toast.success(m['orgAdmin.seating.applyResultToast']({ applied, released }));
			selected.clear();
			reason = '';
			queryClient.invalidateQueries({ queryKey: ['seating-availability', eventId] });
			// Move focus to the result region so keyboard/AT users land on the outcome.
			await tick();
			resultsEl?.focus();
		},
		onError: () => {
			toast.error(m['orgAdmin.seating.applyFailedToast']());
		}
	}));

	function submit(): void {
		if (!requestBody || applyMutation.isPending) return;
		applyMutation.mutate(requestBody);
	}

	const applyDisabled = $derived.by(() => {
		const pending = applyMutation.isPending;
		return requestBody === null || pending || !accessToken;
	});

	const actionOptions: { value: OverrideAction; label: string; description: string }[] = [
		{
			value: 'hold',
			label: m['orgAdmin.seating.actionHold'](),
			description: m['orgAdmin.seating.actionHoldDescription']()
		},
		{
			value: 'kill',
			label: m['orgAdmin.seating.actionKill'](),
			description: m['orgAdmin.seating.actionKillDescription']()
		},
		{
			value: 'release',
			label: m['orgAdmin.seating.actionRelease'](),
			description: m['orgAdmin.seating.actionReleaseDescription']()
		}
	];

	const reasonRequired = $derived(action === 'hold' || action === 'kill');
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
			<span>
				{m['orgAdmin.seating.loadError']()}
			</span>
		</div>
	{:else if !hasSeating}
		<div class="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
			{m['orgAdmin.seating.noSeating']()}
		</div>
	{:else}
		<!-- Current blocked view (honest: overrides are not individually readable) -->
		<section aria-labelledby="blocked-seats-heading" class="rounded-lg border border-border p-4">
			<h2 id="blocked-seats-heading" class="text-sm font-semibold">
				{m['orgAdmin.seating.blockedHeading']()}
				<span class="ml-1 font-normal text-muted-foreground">({blockedSeats.length})</span>
			</h2>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['orgAdmin.seating.blockedExplainer']()}
			</p>
			{#if blockedSeats.length > 0}
				<ul class="mt-3 flex flex-wrap gap-1.5" role="list">
					{#each blockedSeats as seat (seat.id)}
						<li
							class="rounded-md border border-amber-500/60 bg-amber-50 px-2 py-0.5 text-xs dark:bg-amber-950/30"
						>
							{seat.label}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-3 text-xs text-muted-foreground">
					{m['orgAdmin.seating.noBlockedSeats']()}
				</p>
			{/if}
		</section>

		<!-- Result region: rendered before the list so it is near the action bar in
		     DOM order after apply; focused programmatically on every result. -->
		{#if lastResult}
			<div
				bind:this={resultsEl}
				tabindex="-1"
				class="rounded-lg border border-border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				role="status"
			>
				<h2 class="text-sm font-semibold">
					{m['orgAdmin.seating.resultHeading']()}
				</h2>
				<p class="mt-1 text-sm">
					{m['orgAdmin.seating.resultCounts']({
						applied: lastResult.applied,
						released: lastResult.released
					})}
				</p>
				{#if lastResult.rejected.length > 0}
					<h3 class="mt-3 text-xs font-semibold text-destructive">
						{m['orgAdmin.seating.rejectedHeading']({ count: lastResult.rejected.length })}
					</h3>
					<ul class="mt-1 space-y-1 text-sm" role="list">
						{#each lastResult.rejected as entry (entry.seatId)}
							<li class="flex items-start gap-2">
								<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
								<span>
									<span class="font-medium">
										{m['seatSelector.seat']()}
										{entry.seatLabel}
									</span>
									— {entry.reason}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<!-- Seat multi-select list: scrolls within the page -->
		<section
			aria-label={m['orgAdmin.seating.seatListLabel']()}
			class="max-h-[55vh] overflow-y-auto rounded-lg border border-border p-4"
		>
			<p class="mb-3 text-xs text-muted-foreground">
				{m['orgAdmin.seating.seatListHint']()}
			</p>
			<SeatOverrideSectorList {groups} {selected} {onSetSeats} disabled={applyMutation.isPending} />
		</section>

		<!-- Sticky action bar -->
		<form
			class="sticky bottom-0 z-20 -mx-1 space-y-3 rounded-t-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm font-medium" aria-live="polite">
					{m['orgAdmin.seating.selectedCount']({ count: selectedCount })}
				</p>
				{#if selectedCount > 0}
					<Button type="button" variant="ghost" size="sm" onclick={clearSelection}>
						{m['orgAdmin.seating.clearSelection']()}
					</Button>
				{/if}
			</div>

			<fieldset>
				<legend class="text-xs font-medium text-muted-foreground">
					{m['orgAdmin.seating.actionLegend']()}
				</legend>
				<div class="mt-1.5 flex flex-col gap-2 sm:flex-row sm:gap-4">
					{#each actionOptions as option (option.value)}
						<label class="flex items-start gap-2 text-sm">
							<input
								type="radio"
								name="override-action"
								value={option.value}
								checked={action === option.value}
								onchange={() => (action = option.value)}
								class="mt-0.5 h-4 w-4 accent-primary"
							/>
							<span>
								<span class="font-medium">{option.label}</span>
								<span class="block text-xs text-muted-foreground">{option.description}</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>

			{#if action === 'hold'}
				<div class="flex flex-col gap-1">
					<label for="hold-kind" class="text-xs font-medium text-muted-foreground">
						{m['orgAdmin.seating.holdKindLabel']()}
					</label>
					<select
						id="hold-kind"
						class="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
						value={holdKind}
						onchange={(e) => (holdKind = e.currentTarget.value as HoldKind)}
					>
						{#each HOLD_KINDS as kind (kind)}
							<option value={kind}>{holdKindLabel(kind)}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if reasonRequired}
				<div class="flex flex-col gap-1">
					<label for="override-reason" class="text-xs font-medium text-muted-foreground">
						{m['orgAdmin.seating.reasonLabel']()}
					</label>
					<Textarea
						id="override-reason"
						bind:value={reason}
						maxlength={255}
						rows={2}
						required
						placeholder={m['orgAdmin.seating.reasonPlaceholder']()}
					/>
				</div>
			{:else}
				<p class="text-xs text-muted-foreground" aria-live="polite">
					{m['orgAdmin.seating.releaseHint']({
						blocked: selectedBlockedCount,
						selected: selectedCount
					})}
				</p>
			{/if}

			<div class="flex justify-end">
				<Button type="submit" disabled={applyDisabled}>
					{#if applyMutation.isPending}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{action === 'release'
						? m['orgAdmin.seating.submitRelease']()
						: m['orgAdmin.seating.submitApply']()}
				</Button>
			</div>
		</form>
	{/if}
</div>
