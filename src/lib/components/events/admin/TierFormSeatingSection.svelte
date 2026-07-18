<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Building2, LayoutGrid, Armchair, Tag } from '@lucide/svelte';
	import type {
		SeatAssignmentMode,
		VenueDetailSchema,
		VenueSectorSchema,
		PriceCategorySchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		seatAssignmentMode: SeatAssignmentMode;
		maxTicketsPerUser: string;
		sectorId: string | null;
		priceCategoryId: string | null;
		canUseSeatAssignment: boolean;
		venueId: string | null;
		venuesLoading: boolean;
		selectedVenue: VenueDetailSchema | undefined;
		selectedVenueSectors: VenueSectorSchema[];
		standingSectors: VenueSectorSchema[];
		sectorRequired: boolean;
		priceCategories: PriceCategorySchema[];
		chartLoading: boolean;
		chartError: boolean;
		onRetryChart?: () => void;
		categoryRequired: boolean;
		isPending: boolean;
	}

	let {
		seatAssignmentMode = $bindable(),
		maxTicketsPerUser = $bindable(),
		sectorId = $bindable(),
		priceCategoryId = $bindable(),
		canUseSeatAssignment,
		venueId,
		venuesLoading,
		selectedVenue,
		selectedVenueSectors,
		standingSectors,
		sectorRequired,
		priceCategories,
		chartLoading,
		chartError,
		onRetryChart,
		categoryRequired,
		isPending
	}: Props = $props();

	// Price categories ordered for display; the swatch pairs color with the name
	// so meaning is never conveyed by color alone.
	const sortedPriceCategories = $derived(
		[...priceCategories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
	);
	const selectedPriceCategory = $derived(priceCategories.find((c) => c.id === priceCategoryId));
</script>

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
			<option value="best_available" disabled={!canUseSeatAssignment}>
				{m['tierForm.seatingConfig.bestAvailable']?.() ?? 'Best Available (Auto-Assigned Seats)'}
				{!canUseSeatAssignment ? m['tierForm.requiresVenueSuffix']() : ''}
			</option>
			<option value="user_choice" disabled={!canUseSeatAssignment}>
				{m['tierForm.seatingConfig.userChoice']?.() ?? 'User Selects Seat'}
				{!canUseSeatAssignment ? m['tierForm.requiresVenueSuffix']() : ''}
			</option>
		</select>
		<p class="mt-1 text-xs text-muted-foreground">
			{#if !canUseSeatAssignment && seatAssignmentMode === 'none'}
				{m['tierForm.seatingConfig.noVenueConfigured']?.() ??
					'To enable seat assignment, configure a venue for this event in Basic Info.'}
			{:else if seatAssignmentMode === 'none'}
				{m['tierForm.seatingConfig.noneHelp']?.() ??
					'No seat assignment - attendees can sit anywhere'}
			{:else if seatAssignmentMode === 'best_available'}
				{m['tierForm.seatingConfig.bestAvailableHelp']?.() ??
					'The best available adjacent seats in the chosen price category are assigned automatically at purchase'}
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
				'Leave empty to inherit from event (event default is 1)'}
		</p>
	</div>

	<!-- Optional standing-sector capacity cap for general admission (none) tiers.
	     Rendered only when the event has a venue whose chart lists at least one
	     standing sector (standingSectors is chart-derived, so empty until then). -->
	{#if seatAssignmentMode === 'none' && venueId && standingSectors.length > 0}
		<div class="border-t border-border pt-4">
			<Label for="tier-standing-sector">
				<span class="flex items-center gap-1">
					<LayoutGrid class="h-3.5 w-3.5" aria-hidden="true" />
					{m['tierForm.seatingConfig.standingSector']?.() ?? 'Standing sector'}
				</span>
			</Label>
			<select
				id="tier-standing-sector"
				bind:value={sectorId}
				disabled={isPending}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<option value={null}>
					{m['tierForm.seatingConfig.standingSectorNone']?.() ?? 'None (no capacity limit)'}
				</option>
				{#each standingSectors as sector (sector.id)}
					<option value={sector.id}>
						{sector.name}
						{#if sector.code}({sector.code}){/if}
						{#if sector.capacity}{m['tierForm.venueCapacity']({ capacity: sector.capacity })}{/if}
					</option>
				{/each}
			</select>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['tierForm.seatingConfig.standingSectorHelp']?.() ??
					"Optional: link a standing sector to cap this tier's sales at the sector capacity."}
			</p>

			<!-- Same hard-limit warning as the user_choice sector picker -->
			{#if sectorId}
				{@const selectedStandingSector = standingSectors.find((s) => s.id === sectorId)}
				{#if selectedStandingSector?.capacity}
					<div
						class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
					>
						<p class="font-medium text-amber-800 dark:text-amber-200">
							{m['tierForm.sectorHardLimit.title']()}
						</p>
						<p class="mt-1 text-amber-700 dark:text-amber-300">
							{m['tierForm.sectorHardLimit.description']({
								capacity: selectedStandingSector.capacity.toString()
							})}
						</p>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Venue & Sector Selection (only when seat assignment is not 'none') -->
	{#if seatAssignmentMode !== 'none'}
		<div class="space-y-4 border-t border-border pt-4">
			<div class="flex items-center gap-2 text-sm font-medium">
				<Building2 class="h-4 w-4 text-primary" aria-hidden="true" />
				{m['tierForm.seatingConfig.venueSection']?.() ?? 'Venue & Sector'}
			</div>

			<!-- Venue (read-only - comes from event; not a Label: no control to point at) -->
			<div>
				<span class="text-sm font-medium leading-none">
					{m['tierForm.seatingConfig.venue']?.() ?? 'Venue'}
				</span>
				{#if venuesLoading}
					<div
						class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						{m['tierForm.seatingConfig.loadingVenues']?.() ?? 'Loading venue...'}
					</div>
				{:else}
					<div
						class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm"
					>
						{#if selectedVenue}
							<span class="font-medium">{selectedVenue.name}</span>
							{#if selectedVenue.capacity}
								<span class="ml-2 text-muted-foreground"
									>{m['tierForm.venueCapacity']({ capacity: selectedVenue.capacity })}</span
								>
							{/if}
						{:else}
							<span class="text-muted-foreground">
								{m['tierForm.seatingConfig.noVenueSelected']?.() ?? 'No venue configured for event'}
							</span>
						{/if}
					</div>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['tierForm.seatingConfig.venueFromEvent']?.() ??
						'Venue is set at the event level in Basic Info.'}
				</p>
			</div>

			<!-- Sector (user_choice only; only when venue is selected) -->
			{#if seatAssignmentMode === 'user_choice'}
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
							aria-invalid={sectorRequired && !sectorId ? true : undefined}
							aria-describedby="tier-sector-help"
							class="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 {sectorRequired &&
							!sectorId
								? 'border-destructive'
								: 'border-input'}"
						>
							<option value={null}>
								{sectorRequired
									? (m['tierForm.seatingConfig.selectSectorRequired']?.() ??
										'Select a sector (required)')
									: (m['tierForm.seatingConfig.selectSector']?.() ?? 'Select a sector (optional)')}
							</option>
							{#each selectedVenueSectors as sector (sector.id)}
								<option value={sector.id}>
									{sector.name}
									{#if sector.code}({sector.code}){/if}
									{#if sector.capacity}{m['tierForm.sectorSeats']({
											capacity: sector.capacity
										})}{/if}
								</option>
							{/each}
						</select>
						<p
							id="tier-sector-help"
							class="mt-1 text-xs {sectorRequired && !sectorId
								? 'text-destructive'
								: 'text-muted-foreground'}"
						>
							{#if sectorRequired}
								{m['tierForm.seatingConfig.sectorRequiredHelp']?.() ??
									'A sector is required for seat assignment modes other than General Admission'}
							{:else}
								{m['tierForm.seatingConfig.sectorHelp']?.() ??
									'Optionally restrict this tier to a specific sector'}
							{/if}
						</p>

						<!-- Sector Hard Limit Warning -->
						{#if sectorId}
							{@const selectedSector = selectedVenueSectors.find((s) => s.id === sectorId)}
							{#if selectedSector?.capacity}
								<div
									class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
								>
									<p class="font-medium text-amber-800 dark:text-amber-200">
										{m['tierForm.sectorHardLimit.title']()}
									</p>
									<p class="mt-1 text-amber-700 dark:text-amber-300">
										{m['tierForm.sectorHardLimit.description']({
											capacity: selectedSector.capacity.toString()
										})}
									</p>
								</div>
							{/if}
						{/if}
					</div>
				{:else if venueId}
					<p class="text-xs {sectorRequired ? 'text-destructive' : 'text-muted-foreground'}">
						{#if sectorRequired}
							{m['tierForm.seatingConfig.noSectorsRequired']?.() ??
								'This venue has no sectors configured. Sectors are required for this seat assignment mode.'}
						{:else}
							{m['tierForm.seatingConfig.noSectors']?.() ?? 'This venue has no sectors configured.'}
						{/if}
					</p>
				{:else if sectorRequired}
					<p class="text-xs text-destructive">
						{m['tierForm.seatingConfig.venueRequiredForSeats']?.() ??
							'Please select a venue and sector for this seat assignment mode'}
					</p>
				{/if}
			{/if}

			<!-- Price category (best_available only) -->
			{#if seatAssignmentMode === 'best_available'}
				<div>
					<Label for="tier-price-category">
						<span class="flex items-center gap-1">
							<Tag class="h-3.5 w-3.5" aria-hidden="true" />
							{m['tierForm.seatingConfig.priceCategory']?.() ?? 'Price Category'}
							{#if categoryRequired}
								<span class="text-destructive">*</span>
							{/if}
						</span>
					</Label>
					{#if chartLoading}
						<div
							class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
						>
							{m['tierForm.seatingConfig.loadingChart']?.() ?? 'Loading seating chart...'}
						</div>
					{:else if chartError}
						<div
							class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
						>
							{m['tierForm.seatingConfig.priceCategory']?.() ?? 'Price Category'}
						</div>
						<p class="mt-1 text-xs text-destructive" role="alert">
							{m['tierForm.seatingConfig.chartLoadFailed']?.() ??
								'Failed to load the seating chart. Check your connection and try again.'}
						</p>
						{#if onRetryChart}
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="mt-2"
								onclick={onRetryChart}
								disabled={isPending}
							>
								{m['tierForm.seatingConfig.chartRetry']?.() ?? 'Try again'}
							</Button>
						{/if}
					{:else if sortedPriceCategories.length > 0}
						<select
							id="tier-price-category"
							bind:value={priceCategoryId}
							disabled={isPending}
							required={categoryRequired}
							aria-invalid={categoryRequired && !priceCategoryId ? true : undefined}
							aria-describedby="tier-price-category-help"
							class="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 {categoryRequired &&
							!priceCategoryId
								? 'border-destructive'
								: 'border-input'}"
						>
							<option value={null}>
								{m['tierForm.seatingConfig.selectPriceCategoryRequired']?.() ??
									'Select a price category (required)'}
							</option>
							{#each sortedPriceCategories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
						{#if selectedPriceCategory}
							<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
								<span
									class="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
									style="background-color: {selectedPriceCategory.color}"
									aria-hidden="true"
								></span>
								{selectedPriceCategory.name}
							</p>
						{/if}
						<p
							id="tier-price-category-help"
							class="mt-1 text-xs {categoryRequired && !priceCategoryId
								? 'text-destructive'
								: 'text-muted-foreground'}"
						>
							{m['tierForm.seatingConfig.priceCategoryRequiredHelp']?.() ??
								'Seats are auto-assigned from this price category. A price category is required for Best Available.'}
						</p>
					{:else}
						<div
							class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
						>
							{m['tierForm.seatingConfig.priceCategory']?.() ?? 'Price Category'}
						</div>
						<p class="mt-1 text-xs text-destructive">
							{m['tierForm.seatingConfig.noPriceCategories']?.() ??
								"This venue's seating chart has no price categories, so Best Available cannot be used. Add price categories to the venue's seating chart first."}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
