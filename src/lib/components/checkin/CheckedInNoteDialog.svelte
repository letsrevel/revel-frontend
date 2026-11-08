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
	import ScanCallout from './ScanCallout.svelte';
	import type { ScanNote } from './scan-note';

	/**
	 * Shown after a successful scan check-in only when there is a staff note staff
	 * have not already read (the parent drops it when the pre-confirm preview
	 * showed it). The membership standing rides along when there is one; on its own
	 * it never opens this dialog (it goes into the check-in toast instead). A dialog
	 * is announced by assistive tech on open, which is how it joins the scan result.
	 */
	interface Props {
		note: ScanNote | null;
		onClose: () => void;
	}

	const { note, onClose }: Props = $props();

	// The parent clears `note` the moment it is dismissed, while the dialog is
	// still animating out. Keep the last non-null note so the content does not
	// collapse during the exit transition.
	let lastNote = $state<ScanNote | null>(null);
	$effect(() => {
		if (note) lastNote = note;
	});
	const shown = $derived(note ?? lastNote);
	const description = $derived(
		shown?.membership
			? m['scanNote.checkedInDescriptionBoth']()
			: m['scanNote.checkedInDescription']()
	);
</script>

<Dialog open={!!note} onOpenChange={(value) => !value && onClose()}>
	<DialogContent class="sm:max-w-md">
		{#if shown}
			<DialogHeader>
				<DialogTitle>{m['scanNote.checkedInTitle']({ name: shown.name })}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<ScanCallout title={m['scanNote.label']()} body={shown.body} />
			{#if shown.membership}
				<ScanCallout
					title={shown.membership.title}
					body={shown.membership.body}
					plain={shown.membership.plain}
					tone="info"
				/>
			{/if}
			<DialogFooter>
				<Button onclick={onClose}>{m['scanNote.dismiss']()}</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
