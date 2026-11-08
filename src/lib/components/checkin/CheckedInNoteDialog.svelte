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
	 * Shown after a successful scan check-in when the person has a private staff
	 * note. The ticket preview does not carry the note; the check-in response does,
	 * so this surfaces it the moment the scan resolves. A dialog is announced by
	 * assistive tech on open, which is how it joins the scan result.
	 */
	interface Props {
		note: ScanNote | null;
		onClose: () => void;
	}

	const { note, onClose }: Props = $props();
</script>

<Dialog open={!!note} onOpenChange={(value) => !value && onClose()}>
	<DialogContent class="sm:max-w-md">
		{#if note}
			<DialogHeader>
				<DialogTitle>{m['scanNote.checkedInTitle']({ name: note.name })}</DialogTitle>
				<DialogDescription>{m['scanNote.checkedInDescription']()}</DialogDescription>
			</DialogHeader>
			<ScanCallout title={m['scanNote.label']()} body={note.body} />
			<DialogFooter>
				<Button onclick={onClose}>{m['scanNote.dismiss']()}</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
