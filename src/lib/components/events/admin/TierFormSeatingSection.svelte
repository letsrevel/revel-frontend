<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Building2, LayoutGrid, Armchair, Tag, TriangleAlert } from '@lucide/svelte';
	import type {
		SeatAssignmentMode,
		TierPricingGapSchema,
		VenueDetailSchema,
		VenueSectorSchema,
		PriceCategorySchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		seatAssignmentMode: SeatAssignmentMode;
		maxTicketsPerUser: string;
		sectorId: string | null;
		/** Per-category prices — the single pricing mechanism for both seated modes. */
		categoryPrices: Record<string, string>;
		/** Categories offered in the pricing editor (painted in sector ∪ priced). */
		pricingCategories: PriceCategorySchema[];
		/** Server-flagged coverage gaps (user_choice only; empty for best_available by design). */
		pricingGaps: TierPricingGapSchema[];
		currencySymbol: string;
		canUseSeatAssignment: boolean;
		venueId: string | null;
		venuesLoading: boolean;
		selectedVenue: VenueDetailSchema | undefined;
		selectedVenueSectors: VenueSectorSchema[];
		standingSectors: VenueSectorSchema[];
		sectorRequired: boolean;
		chartLoading: boolean;
		chartError: boolean;
		onRetryChart?: () => void;
		isPending: boolean;
	}

	let {
		seatAssignmentMode = $bindable(),
		maxTicketsPerUser = $bindable(),
		sectorId = $bindable(),
		categoryPrices = $bindable(),
		pricingCategories,
		pricingGaps,
		currencySymbol,
		canUseSeatAssignment,
		venueId,
		venuesLoading,
		selectedVenue,
		selectedVenueSectors,
		standingSectors,
		sectorRequired,
		chartLoading,
		chartError,
		onRetryChart,
		isPending
	}: Props = $props();

	// Pricing rows (both seated modes), in category order. The swatch pairs
	// color with the name so meaning is never conveyed by color alone.
	const sortedPricingCategories = $derived(
		[...pricingCategories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
	);
	const gapNames = $derived(pricingGaps.map((gap) => gap.name).join(', '));
	const isBestAvailable = $derived(seatAssignmentMode === 'best_available');

	// Keep money inputs dot-decimal as the user types (mirrors the VAT input).
	function handlePriceInput(categoryId: string, event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		categoryPrices = { ...categoryPrices, [categoryId]: raw.replace(',', '.') };
	}
</script>

<!-- Seating Configuration Section -->
<div class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
	<div class="flex items-center gap-2 text-sm font-medium">
		<Armchair class="h-4 w-4 text-primary" aria-hidden="true" />
		{m['tierForm.seatingConfig.title']()}
	</div>

	<!-- Seat Assignment Mode -->
	<div>
		<Label for="seat-assignment-mode">
			{m['tierForm.seatingConfig.mode']()}
		</Label>
		<select
			id="seat-assignment-mode"
			bind:value={seatAssignmentMode}
			disabled={isPending}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<option value="none">
				{m['tierForm.seatingConfig.none']()}
			</option>
			<option value="best_available" disabled={!canUseSeatAssignment}>
				{m['tierForm.seatingConfig.bestAvailable']()}
				{!canUseSeatAssignment ? m['tierForm.requiresVenueSuffix']() : ''}
			</option>
			<option value="user_choice" disabled={!canUseSeatAssignment}>
				{m['tierForm.seatingConfig.userChoice']()}
				{!canUseSeatAssignment ? m['tierForm.requiresVenueSuffix']() : ''}
			</option>
		</select>
		<p class="mt-1 text-xs text-muted-foreground">
			{#if !canUseSeatAssignment && seatAssignmentMode === 'none'}
				{m['tierForm.seatingConfig.noVenueConfigured']()}
			{:else if seatAssignmentMode === 'none'}
				{m['tierForm.seatingConfig.noneHelp']()}
			{:else if seatAssignmentMode === 'best_available'}
				{m['tierForm.seatingConfig.bestAvailableHelp']()}
			{:else}
				{m['tierForm.seatingConfig.userChoiceHelp']()}
			{/if}
		</p>
	</div>

	<!-- Max Tickets Per User -->
	<div>
		<Label for="max-tickets-per-user">
			{m['tierForm.seatingConfig.maxTickets']()}
		</Label>
		<Input
			id="max-tickets-per-user"
			type="number"
			min="1"
			bind:value={maxTicketsPerUser}
			placeholder={m['tierForm.seatingConfig.inheritFromEvent']()}
			disabled={isPending}
		/>
		<p class="mt-1 text-xs text-muted-foreground">
			{m['tierForm.seatingConfig.maxTicketsHelp']()}
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
					{m['tierForm.seatingConfig.standingSector']()}
				</span>
			</Label>
			<select
				id="tier-standing-sector"
				bind:value={sectorId}
				disabled={isPending}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<option value={null}>
					{m['tierForm.seatingConfig.standingSectorNone']()}
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
				{m['tierForm.seatingConfig.standingSectorHelp']()}
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
				{m['tierForm.seatingConfig.venueSection']()}
			</div>

			<!-- Venue (read-only - comes from event; not a Label: no control to point at) -->
			<div>
				<span class="text-sm font-medium leading-none">
					{m['tierForm.seatingConfig.venue']()}
				</span>
				{#if venuesLoading}
					<div
						class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						{m['tierForm.seatingConfig.loadingVenues']()}
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
								{m['tierForm.seatingConfig.noVenueSelected']()}
							</span>
						{/if}
					</div>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['tierForm.seatingConfig.venueFromEvent']()}
				</p>
			</div>

			<!-- Sector (both seated modes require one; only when venue is selected) -->
			{#if seatAssignmentMode === 'user_choice' || seatAssignmentMode === 'best_available'}
				{#if venueId && selectedVenueSectors.length > 0}
					<div>
						<Label for="tier-sector">
							<span class="flex items-center gap-1">
								<LayoutGrid class="h-3.5 w-3.5" aria-hidden="true" />
								{m['tierForm.seatingConfig.sector']()}
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
									? m['tierForm.seatingConfig.selectSectorRequired']()
									: m['tierForm.seatingConfig.selectSector']()}
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
								{m['tierForm.seatingConfig.sectorRequiredHelp']()}
							{:else}
								{m['tierForm.seatingConfig.sectorHelp']()}
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
							{m['tierForm.seatingConfig.noSectorsRequired']()}
						{:else}
							{m['tierForm.seatingConfig.noSectors']()}
						{/if}
					</p>
				{:else if sectorRequired}
					<p class="text-xs text-destructive">
						{m['tierForm.seatingConfig.venueRequiredForSeats']()}
					</p>
				{/if}

				<!-- Per-category prices — the ONE pricing mechanism for both seated
				     modes. user_choice: seats painted with a category sell at that
				     category's price, a non-empty map must cover every painted
				     category, unpainted seats sell at the base price. best_available:
				     the priced categories DEFINE the tier's sellable zones — partial
				     coverage is the feature, so no gap warning here by design. -->
				{#if sectorId && chartError}
					<div class="space-y-2 border-t border-border pt-4">
						<p class="text-xs text-destructive" role="alert">
							{m['tierForm.seatingConfig.chartLoadFailed']()}
						</p>
						{#if onRetryChart}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={onRetryChart}
								disabled={isPending}
							>
								{m['tierForm.seatingConfig.chartRetry']()}
							</Button>
						{/if}
					</div>
				{:else if sectorId && chartLoading}
					<p class="border-t border-border pt-4 text-xs text-muted-foreground">
						{m['tierForm.seatingConfig.loadingChart']()}
					</p>
				{:else if sectorId && sortedPricingCategories.length > 0}
					<div class="space-y-3 border-t border-border pt-4">
						<div class="flex items-center gap-2 text-sm font-medium">
							<Tag class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
							{isBestAvailable
								? m['tierForm.categoryPrices.zonesTitle']()
								: m['tierForm.categoryPrices.title']()}
						</div>
						<p class="text-xs text-muted-foreground">
							{isBestAvailable
								? m['tierForm.categoryPrices.zonesHelp']()
								: m['tierForm.categoryPrices.help']()}
						</p>

						{#if pricingGaps.length > 0 && !isBestAvailable}
							<div
								class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
								role="alert"
							>
								<p class="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-200">
									<TriangleAlert class="h-4 w-4 shrink-0" aria-hidden="true" />
									{m['tierForm.categoryPrices.gapsTitle']()}
								</p>
								<p class="mt-1 text-amber-700 dark:text-amber-300">
									{m['tierForm.categoryPrices.gapsDescription']({ categories: gapNames })}
								</p>
							</div>
						{/if}

						<div class="space-y-2">
							{#each sortedPricingCategories as category (category.id)}
								{#if category.id}
									<div class="flex items-center gap-3">
										<Label
											for="category-price-{category.id}"
											class="flex min-w-0 flex-1 items-center gap-1.5 font-normal"
										>
											<span
												class="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
												style="background-color: {category.color}"
												aria-hidden="true"
											></span>
											<span class="truncate">{category.name}</span>
										</Label>
										<div class="relative w-32">
											<span
												class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
												aria-hidden="true"
											>
												{currencySymbol}
											</span>
											<Input
												id="category-price-{category.id}"
												type="text"
												inputmode="decimal"
												class="pl-8"
												value={categoryPrices[category.id] ?? ''}
												oninput={(e) => category.id && handlePriceInput(category.id, e)}
												placeholder={m['tierForm.categoryPrices.placeholder']()}
												disabled={isPending}
											/>
										</div>
									</div>
								{/if}
							{/each}
						</div>
						<p class="text-xs text-muted-foreground">
							{isBestAvailable
								? m['tierForm.categoryPrices.zonesCapacityNote']()
								: m['tierForm.categoryPrices.unpaintedHelp']()}
						</p>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
