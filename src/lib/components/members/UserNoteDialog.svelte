<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import StaffNoteEditor from './StaffNoteEditor.svelte';

	/**
	 * The private organizer note about one person (#1165) in a dialog: a thin shell
	 * around `StaffNoteEditor` (the editor the person sheet also uses), closing
	 * itself once a save or delete went through.
	 *
	 * Callers must only mount this for viewers holding `manage_members`. It is
	 * mounted conditionally (one mount = one editing session) and always open.
	 */
	interface Props {
		slug: string;
		/** The person the note is about. */
		userId: string;
		displayName: string;
		accessToken: string | null | undefined;
		onClose: () => void;
	}

	const { slug, userId, displayName, accessToken, onClose }: Props = $props();
</script>

<Dialog open={true} onOpenChange={(value) => (!value ? onClose() : undefined)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<DialogHeader>
			<DialogTitle>{m['userNote.title']({ name: displayName })}</DialogTitle>
			<DialogDescription>{m['userNote.hint']()}</DialogDescription>
		</DialogHeader>
		<StaffNoteEditor
			{slug}
			{accessToken}
			target={{ kind: 'user', userId }}
			showHeader={false}
			onChanged={onClose}
		/>
	</DialogContent>
</Dialog>
