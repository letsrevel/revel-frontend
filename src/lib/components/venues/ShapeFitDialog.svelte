<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import SeatLayoutPreview, { type PreviewSeat } from './SeatLayoutPreview.svelte';
	import type { Coordinate2d } from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		violatingCount: number;
		/** Baked seats, for the in-dialog thumbnail. */
		seats?: PreviewSeat[];
		/** Current outline (solid) — what the seats no longer fit inside. */
		shape?: Coordinate2d[] | null;
		/** Auto-fit candidate (dashed) — what "Auto-fit outline" would write. */
		proposedShape?: Coordinate2d[] | null;
		invertRowOrder?: boolean;
		onChoose: (choice: 'fit' | 'clear' | 'cancel') => void;
	}

	let {
		open = $bindable(),
		violatingCount,
		seats = [],
		shape = null,
		proposedShape = null,
		invertRowOrder = false,
		onChoose
	}: Props = $props();

	// Buttons never toggle `open` themselves — the caller's `handleShapeChoice`
	// flips the bound `shapeDialogOpen` state, which flows back down through
	// `bind:open` and closes the dialog. Escape/overlay/the built-in ✕ all
	// route through bits-ui's own open-state change instead, so they are
	// caught here and normalized to the same 'cancel' choice.
	function handleOpenChange(next: boolean) {
		if (!next) onChoose('cancel');
	}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="max-h-[90vh] max-w-md overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['seatGridEditor.shapeFit.title']()}</DialogTitle>
			<DialogDescription>
				{m['seatGridEditor.shapeFit.body']({ count: violatingCount })}
			</DialogDescription>
		</DialogHeader>

		<!-- The proposed outline used to be drawn only in the editor's side
		     preview, i.e. BEHIND this modal's overlay — invisible exactly when
		     the choice is being made. It lives here now: current outline solid,
		     the auto-fit candidate dashed, over the baked seats. -->
		<SeatLayoutPreview {seats} {shape} {proposedShape} {invertRowOrder} />

		<DialogFooter class="flex-col gap-2 sm:flex-col sm:space-x-0">
			<Button class="w-full" onclick={() => onChoose('fit')}>
				{m['seatGridEditor.shapeFit.fit']()}
			</Button>
			<Button class="w-full" variant="outline" onclick={() => onChoose('clear')}>
				{m['seatGridEditor.shapeFit.clear']()}
			</Button>
			<Button class="w-full" variant="ghost" onclick={() => onChoose('cancel')}>
				{m['seatGridEditor.shapeFit.cancel']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
