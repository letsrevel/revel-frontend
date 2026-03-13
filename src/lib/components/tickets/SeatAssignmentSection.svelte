<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Armchair, Loader2, AlertCircle, Shuffle, DoorOpen } from 'lucide-svelte';
	import type { VenueSeatSchema, SectorAvailabilitySchema } from '$lib/api/generated/types.gen';
	import SeatSelector from './SeatSelector.svelte';

	interface Props {
		isUserChoiceSeat: boolean;
		isRandomSeat: boolean;
		hasSeatedTier: boolean;
		tierVenue: { name: string } | null;
		tierSector: { name: string } | null;
		quantity: number;
		selectedSeatIds: string[];
		seatSelectionError: string;
		isLoadingSeats: boolean;
		seatLoadError: string | null;
		seatAvailability: SectorAvailabilitySchema | null;
		onToggleSeat: (seatId: string) => void;
	}

	let {
		isUserChoiceSeat,
		isRandomSeat,
		hasSeatedTier,
		tierVenue,
		tierSector,
		quantity,
		selectedSeatIds,
		seatSelectionError,
		isLoadingSeats,
		seatLoadError,
		seatAvailability,
		onToggleSeat
	}: Props = $props();

	let availableSeats = $derived<VenueSeatSchema[]>(
		seatAvailability?.seats?.filter((s) => s.available && s.id) ?? []
	);
</script>

{#if isUserChoiceSeat}
	<!-- Seat Selection UI for user_choice mode -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<Label class="flex items-center gap-2">
				<Armchair class="h-4 w-4" />
				{m['ticketConfirmationDialog.selectSeats']?.() ?? 'Select Your Seats'}
			</Label>
			<span class="text-sm text-muted-foreground">
				{selectedSeatIds.length} / {quantity}
				{m['ticketConfirmationDialog.seatsSelected']?.() ?? 'selected'}
			</span>
		</div>

		{#if tierVenue || tierSector}
			<p class="text-sm text-muted-foreground">
				{#if tierVenue}
					<span class="font-medium">{tierVenue.name}</span>
				{/if}
				{#if tierSector}
					<span> - {tierSector.name}</span>
				{/if}
			</p>
		{/if}

		{#if isLoadingSeats}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				<span class="ml-2 text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.loadingSeats']?.() ?? 'Loading available seats...'}
				</span>
			</div>
		{:else if seatLoadError}
			<Alert variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{seatLoadError}</AlertDescription>
			</Alert>
		{:else if availableSeats.length === 0}
			<Alert>
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>
					{m['ticketConfirmationDialog.noSeatsAvailable']?.() ??
						'No seats available for selection.'}
				</AlertDescription>
			</Alert>
		{:else}
			<!-- Seat Selection Grid -->
			<div class="max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-3">
				<SeatSelector
					seats={seatAvailability?.seats ?? []}
					{selectedSeatIds}
					maxSelectable={quantity}
					onToggle={onToggleSeat}
				/>
			</div>
			<!-- Seat Selection Error -->
			{#if seatSelectionError}
				<Alert variant="destructive" class="mt-3">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>{seatSelectionError}</AlertDescription>
				</Alert>
			{/if}
		{/if}
	</div>
{:else if hasSeatedTier}
	<div class="rounded-lg border border-border bg-muted/30 p-4">
		<div class="flex items-start gap-3">
			{#if isRandomSeat}
				<Shuffle
					class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500"
					aria-hidden="true"
				/>
				<div class="space-y-1">
					<p class="font-medium text-foreground">
						{m['ticketConfirmationDialog.randomSeatAssignment']?.() ??
							'Random Seat Assignment'}
					</p>
					<p class="text-sm text-muted-foreground">
						{m['ticketConfirmationDialog.randomSeatAssignmentDesc']?.() ??
							'Seats will be randomly assigned to you from the available seats in the designated sector.'}
					</p>
					{#if tierVenue || tierSector}
						<p class="mt-2 text-sm">
							{#if tierVenue}
								<span class="font-medium">{tierVenue.name}</span>
							{/if}
							{#if tierSector}
								<span class="text-muted-foreground">
									{tierVenue ? ' - ' : ''}{tierSector.name}
								</span>
							{/if}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else if tierVenue}
	<!-- General Entrance with venue info -->
	<div class="rounded-lg border border-border bg-muted/30 p-4">
		<div class="flex items-start gap-3">
			<DoorOpen class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="space-y-1">
				<p class="font-medium text-foreground">
					{m['ticketConfirmationDialog.generalEntrance']?.() ?? 'General Entrance'}
				</p>
				<p class="text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.generalEntranceDesc']?.() ??
						'This ticket grants general admission without assigned seating.'}
				</p>
				<p class="mt-2 text-sm font-medium">{tierVenue.name}</p>
			</div>
		</div>
	</div>
{/if}
