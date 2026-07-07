<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle, Loader2, MapPin, Info } from '@lucide/svelte';
	import SeatSelector from '$lib/components/tickets/SeatSelector.svelte';
	import type { VenueSeatSchema } from '$lib/api/generated/types.gen';

	interface Props {
		isUserChoiceSeat: boolean;
		isRandomSeat: boolean;
		tierVenue: { name: string } | null;
		tierSector: { name: string } | null;
		tierSectorDescription: string | undefined;
		isLoadingSeats: boolean;
		seatLoadError: string | null;
		availableSeats: VenueSeatSchema[];
		selectedSeatIds: string[];
		quantity: number;
		seatSelectionError: string;
		onToggle: (seatId: string) => void;
	}

	const {
		isUserChoiceSeat,
		isRandomSeat,
		tierVenue,
		tierSector,
		tierSectorDescription,
		isLoadingSeats,
		seatLoadError,
		availableSeats,
		selectedSeatIds,
		quantity,
		seatSelectionError,
		onToggle
	}: Props = $props();
</script>

{#if isUserChoiceSeat}
	<div class="space-y-3">
		<!-- Venue/Sector Info -->
		{#if tierVenue || tierSector}
			<div class="rounded-lg border border-border bg-muted/30 p-3">
				<div class="flex items-start gap-2 text-sm text-muted-foreground">
					<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
					<div class="space-y-0.5">
						{#if tierVenue}
							<div class="font-medium text-foreground">{tierVenue.name}</div>
						{/if}
						{#if tierSector}
							<div>
								{tierSector.name}
								{#if tierSectorDescription}
									<span class="text-xs">({tierSectorDescription})</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Seat selection UI -->
		<div class="space-y-2">
			<Label>{m['guestTicketDialog.selectYourSeat']()}</Label>
			{#if isLoadingSeats}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
				</div>
			{:else if seatLoadError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>{seatLoadError}</AlertDescription>
				</Alert>
			{:else if availableSeats.length === 0}
				<Alert>
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>{m['guestTicketDialog.noSeatsAvailable']()}</AlertDescription>
				</Alert>
			{:else}
				<SeatSelector
					seats={availableSeats}
					{selectedSeatIds}
					maxSelectable={quantity}
					{onToggle}
				/>
				{#if quantity > 1}
					<p class="text-sm text-muted-foreground">
						{quantity === 1
							? m['guestTicketDialog.selectedSeatsOne']({
									selected: selectedSeatIds.length
								})
							: m['guestTicketDialog.selectedSeats']({
									selected: selectedSeatIds.length,
									total: quantity
								})}
					</p>
				{/if}
				{#if seatSelectionError}
					<p class="text-sm text-destructive" role="alert">
						{seatSelectionError}
					</p>
				{/if}
			{/if}
		</div>
	</div>
{:else if isRandomSeat}
	<!-- Random seat assignment info -->
	<Alert>
		<Info class="h-4 w-4" />
		<AlertDescription>
			{m['guestTicketDialog.randomSeatNotice']()}
		</AlertDescription>
	</Alert>
{/if}
