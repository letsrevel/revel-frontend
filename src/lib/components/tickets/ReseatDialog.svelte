<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		eventadminseatingBoxOfficeReseat,
		eventpublicseatingGetAvailability,
		eventpublicseatingGetChart
	} from '$lib/api';
	import type {
		AdminTicketSchema,
		BoxOfficeReseatRequest,
		SeatingAvailabilitySchema,
		VenueChartSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, LoaderCircle } from '@lucide/svelte';
	import { sectorGroupsFrom } from '$lib/components/events/admin/seating/seat-override-model';
	import BoxOfficeSeatPicker from '$lib/components/events/admin/seating/BoxOfficeSeatPicker.svelte';
	import type { SeatView } from './seating-view';
	import { extractPurchaseErrorMessage } from './purchase-error';
	import { reseatTargetSeatIds } from './reseat-model';
	import { getSeatDisplay } from '$lib/utils/ticket-helpers';

	interface Props {
		open: boolean;
		ticket: AdminTicketSchema | null;
		eventId: string;
		accessToken: string | null;
		onClose: () => void;
		/** Called after a successful reseat so the parent can refresh its list. */
		onReseated: () => void;
	}

	const { open, ticket, eventId, accessToken, onClose, onReseated }: Props = $props();

	const queryClient = useQueryClient();
	const CHART_STALE_TIME_MS = 5 * 60 * 1000;

	const chartQuery = createQuery<VenueChartSchema | null, Error>(() => ({
		queryKey: ['seating-chart', eventId],
		staleTime: CHART_STALE_TIME_MS,
		enabled: open,
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
		enabled: open,
		queryFn: async () => {
			const response = await eventpublicseatingGetAvailability({ path: { event_id: eventId } });
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load seat availability');
			}
			return response.data;
		}
	}));

	const isLoading = $derived.by(() => {
		const chartPending = chartQuery.isPending;
		const availabilityPending = availabilityQuery.isPending;
		return chartPending || availabilityPending;
	});

	const chart = $derived(chartQuery.data ?? null);
	const availability = $derived(availabilityQuery.data ?? null);
	const currentSeatId = $derived(ticket?.seat?.id ?? null);
	const currentSeatDisplay = $derived(ticket ? getSeatDisplay(ticket) : null);

	const groups = $derived(chart && availability ? sectorGroupsFrom(chart, availability) : []);
	const eligibleIds = $derived(
		chart && availability
			? reseatTargetSeatIds(chart, availability, currentSeatId)
			: new Set<string>()
	);

	let selectedSeatId = $state<string | null>(null);

	// Reset the picked seat whenever the dialog opens on a new ticket.
	$effect(() => {
		if (open) {
			void ticket?.id;
			selectedSeatId = null;
		}
	});

	function isSelectable(seat: SeatView): boolean {
		return eligibleIds.has(seat.id);
	}

	const reseatMutation = createMutation(() => ({
		mutationFn: async (body: BoxOfficeReseatRequest): Promise<AdminTicketSchema> => {
			const response = await eventadminseatingBoxOfficeReseat({
				path: { event_id: eventId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error !== undefined || !response.data) {
				throw response.error ?? new Error('Reseat failed');
			}
			return response.data;
		},
		onSuccess: (updated: AdminTicketSchema) => {
			toast.success(
				m['reseatDialog.successToast']?.({ seat: updated.seat?.label ?? '' }) ??
					`Moved to seat ${updated.seat?.label ?? ''}`
			);
			queryClient.invalidateQueries({ queryKey: ['seating-availability', eventId] });
			onReseated();
			onClose();
		},
		onError: (err: unknown) => {
			toast.error(
				extractPurchaseErrorMessage(
					err,
					m['reseatDialog.failedToast']?.() ?? 'Could not move the ticket to that seat'
				)
			);
		}
	}));

	function submit(): void {
		if (!ticket?.id || !selectedSeatId || reseatMutation.isPending) return;
		reseatMutation.mutate({ ticket_id: ticket.id, target_seat_id: selectedSeatId });
	}
</script>

<Dialog {open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['reseatDialog.title']?.() ?? 'Move seat'}</DialogTitle>
		</DialogHeader>

		<div class="mt-4 space-y-4">
			<div class="rounded-lg border border-border bg-muted/40 p-3 text-sm">
				<span class="text-muted-foreground"
					>{m['reseatDialog.currentSeat']?.() ?? 'Current seat'}:</span
				>
				<span class="font-medium text-primary">
					{currentSeatDisplay ?? m['reseatDialog.noSeat']?.() ?? 'No seat assigned'}
				</span>
			</div>

			{#if !currentSeatId}
				<div
					class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
					role="alert"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
					<span>{m['reseatDialog.noSeatError']?.() ?? 'This ticket has no seat to move.'}</span>
				</div>
			{:else if isLoading}
				<div class="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
					<LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['orgAdmin.seating.loading']()}
				</div>
			{:else if eligibleIds.size === 0}
				<p class="py-4 text-sm text-muted-foreground">
					{m['reseatDialog.noTargets']?.() ??
						'No free seats are available in the same price category.'}
				</p>
			{:else}
				<div>
					<p class="mb-2 text-sm font-medium">
						{m['reseatDialog.pickTarget']?.() ?? 'Choose a free seat in the same price category'}
					</p>
					<div class="max-h-[45vh] overflow-y-auto rounded-lg border border-border p-4">
						<BoxOfficeSeatPicker
							{groups}
							bind:selectedSeatId
							{isSelectable}
							name="reseat-target"
							disabled={reseatMutation.isPending}
						/>
					</div>
				</div>
			{/if}
		</div>

		<div class="mt-6 flex justify-end gap-2 border-t pt-4">
			<Button variant="outline" onclick={onClose} disabled={reseatMutation.isPending}>
				{m['reseatDialog.cancel']?.() ?? 'Cancel'}
			</Button>
			<Button onclick={submit} disabled={!selectedSeatId || reseatMutation.isPending}>
				{#if reseatMutation.isPending}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['reseatDialog.confirm']?.() ?? 'Move ticket'}
			</Button>
		</div>
	</DialogContent>
</Dialog>
