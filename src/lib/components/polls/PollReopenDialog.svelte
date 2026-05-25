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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		open: boolean;
		submitting: boolean;
		/** Poll's current closes_at — when null, "Keep open" defaults to checked. */
		currentClosesAt: string | null;
		onCancel: () => void;
		onConfirm: (closesAt: string | null, clearClosesAt: boolean) => void;
	}
	let { open = $bindable(), submitting, currentClosesAt, onCancel, onConfirm }: Props = $props();

	let closesAt = $state<string>('');
	// Default to "keep open" when the poll had no prior schedule — that's the
	// only state the backend will accept without an explicit future date.
	let clearClosesAt = $state(currentClosesAt === null);

	// Reset state whenever the dialog re-opens (so closing/reopening doesn't
	// inherit stale values from the previous attempt).
	$effect(() => {
		if (open) {
			closesAt = '';
			clearClosesAt = currentClosesAt === null;
		}
	});

	const canSubmit = $derived(clearClosesAt || !!closesAt);
</script>

<Dialog bind:open>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{m['pollReopenDialog.title']()}</DialogTitle>
			<DialogDescription>{m['pollReopenDialog.description']()}</DialogDescription>
		</DialogHeader>
		<div class="space-y-3">
			<div class="space-y-2">
				<Label for="reopen-closes-at">{m['pollReopenDialog.closesAtLabel']()}</Label>
				<Input
					id="reopen-closes-at"
					type="datetime-local"
					bind:value={closesAt}
					disabled={clearClosesAt}
				/>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={clearClosesAt} class="h-4 w-4" />
				{m['pollReopenDialog.clearClosesAtLabel']()}
			</label>
		</div>
		<DialogFooter>
			<Button variant="outline" onclick={onCancel}>{m['pollReopenDialog.cancel']()}</Button>
			<Button
				onclick={() =>
					onConfirm(
						clearClosesAt ? null : closesAt ? new Date(closesAt).toISOString() : null,
						clearClosesAt
					)}
				disabled={submitting || !canSubmit}
			>
				{m['pollReopenDialog.confirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
