<script lang="ts">
	/**
	 * Prompt shown when the buyer, inside a tier's purchase dialog with the
	 * whole-venue map open, clicks ANOTHER sector: switching section means
	 * switching tier (and releasing any held seats), so it must be an explicit
	 * choice — never a silent swap. One button per purchasable tier of the
	 * target sector (usually one; the seeded Platea has two), with the same
	 * price + assignment-mode hints as the overview chooser.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { SectorOverviewEntry, SectorTierMode } from '$lib/components/events/venue-overview';

	interface Props {
		/** Target sector, or null when the prompt is closed. */
		entry: SectorOverviewEntry | null;
		/** Seats currently held in the active sector (release warning when > 0). */
		heldCount: number;
		onPick: (tier: TierSchemaWithId) => void;
		onCancel: () => void;
	}

	const { entry, heldCount, onPick, onCancel }: Props = $props();

	function modeHint(mode: SectorTierMode): string {
		if (mode === 'user_choice') return m['venueOverview.modeUserChoice']();
		if (mode === 'best_available') return m['venueOverview.modeBestAvailable']();
		return m['venueOverview.modeGeneral']();
	}
</script>

<Dialog open={entry !== null} onOpenChange={(open) => !open && onCancel()}>
	<DialogContent class="sm:max-w-md">
		{#if entry}
			<DialogHeader>
				<DialogTitle>{m['sectorSwitch.title']({ sector: entry.sectorName })}</DialogTitle>
				<DialogDescription>
					{#if heldCount > 0}
						{m['sectorSwitch.releaseWarning']({ count: heldCount })}
					{:else}
						{m['sectorSwitch.hint']()}
					{/if}
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-2">
				{#each entry.options as option (option.tier.id)}
					<Button
						variant="outline"
						class="h-auto w-full justify-between gap-3 py-3 text-left"
						onclick={() => onPick(option.tier)}
					>
						<span class="min-w-0">
							<span class="block truncate font-medium">{option.tier.name}</span>
							<span class="block text-xs font-normal text-muted-foreground">
								{modeHint(option.mode)}
							</span>
						</span>
						<span class="shrink-0 font-semibold">{option.priceDisplay}</span>
					</Button>
				{/each}
			</div>
			<Button variant="ghost" class="w-full" onclick={onCancel}>
				{m['ticketConfirmationDialog.cancel']()}
			</Button>
		{/if}
	</DialogContent>
</Dialog>
