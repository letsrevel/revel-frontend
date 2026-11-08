<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		/** Editing an existing tier (shows Delete, "Save changes"). */
		isEditing: boolean;
		isPending: boolean;
		isDeleting: boolean;
		/** Submit is held for a reason the form already explains (validation, gates). */
		submitDisabled: boolean;
		/** Id of the element explaining why the save is held. */
		describedBy?: string;
		onDelete: () => void;
		onClose: () => void;
	}

	const {
		isEditing,
		isPending,
		isDeleting,
		submitDisabled,
		describedBy,
		onDelete,
		onClose
	}: Props = $props();
</script>

<div class="flex justify-between gap-2 border-t border-border pt-4">
	<div>
		{#if isEditing}
			<Button type="button" variant="destructive" onclick={onDelete} disabled={isPending}>
				{isDeleting ? m['tierForm.deleting']() : m['tierForm.deleteTier']()}
			</Button>
		{/if}
	</div>
	<div class="flex gap-2">
		<Button type="button" variant="outline" onclick={onClose} disabled={isPending}>
			{m['tierForm.cancel']()}
		</Button>
		<Button
			type="submit"
			disabled={isPending || submitDisabled}
			aria-describedby={describedBy || undefined}
		>
			{isPending
				? m['tierForm.saving']()
				: isEditing
					? m['tierForm.saveChanges']()
					: m['tierForm.createTier']()}
		</Button>
	</div>
</div>
