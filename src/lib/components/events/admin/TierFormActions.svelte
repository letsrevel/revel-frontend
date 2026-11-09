<script lang="ts">
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { grantConflicts } from './tier-grants';

	interface Props {
		/** Editing an existing tier (shows Delete, "Save changes"). */
		isEditing: boolean;
		/** Name of the tier being edited, shown in the delete confirmation. */
		tierName?: string;
		isPending: boolean;
		isDeleting: boolean;
		/** Submit is held for a reason the form already explains (validation, gates). */
		submitDisabled: boolean;
		/** Id of the element explaining why the save is held. */
		describedBy?: string;
		/** Grant state; a rule it breaks holds the save here, with a visible reason. */
		grantInputs?: { grantId: string; purchasableBy: string; maxTicketsPerUser: string };
		onDelete: () => void;
		onClose: () => void;
	}

	const {
		isEditing,
		tierName = '',
		isPending,
		isDeleting,
		submitDisabled,
		describedBy,
		grantInputs,
		onDelete,
		onClose
	}: Props = $props();

	let showDeleteConfirm = $state(false);

	const uid = $props.id();
	const conflictId = `${uid}-grant-conflict`;
	const grantConflict = $derived.by(() => {
		if (!grantInputs) return false;
		const c = grantConflicts(
			grantInputs.grantId,
			grantInputs.purchasableBy,
			grantInputs.maxTicketsPerUser
		);
		return c.audience || c.maxTickets;
	});
	const submitDescribedBy = $derived(
		[describedBy, grantConflict ? conflictId : ''].filter(Boolean).join(' ') || undefined
	);
</script>

{#if grantConflict}
	<p id={conflictId} class="text-sm text-destructive" data-testid="tier-grants-conflict">
		{m['tierForm.grants.conflict']()}
	</p>
{/if}

<div class="flex justify-between gap-2 border-t border-border pt-4">
	<div>
		{#if isEditing}
			<Button
				type="button"
				variant="destructive"
				onclick={() => (showDeleteConfirm = true)}
				disabled={isPending}
			>
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
			disabled={isPending || submitDisabled || grantConflict}
			aria-describedby={submitDescribedBy}
		>
			{isPending
				? m['tierForm.saving']()
				: isEditing
					? m['tierForm.saveChanges']()
					: m['tierForm.createTier']()}
		</Button>
	</div>
</div>

<ConfirmDialog
	isOpen={showDeleteConfirm}
	title={m['confirmDialog.title']()}
	message={m['tierForm.deleteConfirm']({ name: tierName })}
	confirmText={m['confirmDialog.delete']()}
	variant="danger"
	onConfirm={() => {
		showDeleteConfirm = false;
		onDelete();
	}}
	onCancel={() => (showDeleteConfirm = false)}
/>
