<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { TriangleAlert } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { unlinkRecord } from '$lib/member-register/api';
	import { unlinkEffect } from '$lib/member-register/reconcile';
	import ConfirmRecordDialog from './ConfirmRecordDialog.svelte';

	interface Props {
		open: boolean;
		record: MembershipRecordSchema | null;
		/** False once a refetch shows the entry is gone from the list. */
		recordPresent?: boolean;
		slug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	const { open, record, recordPresent = true, slug, accessToken, onClose }: Props = $props();

	const outcome = $derived(record ? unlinkEffect(record) : null);

	// Set once OUR unlink succeeded: the refetch that follows then shows the entry
	// as unlinked too, which must not be mistaken for "someone else already did it".
	let unlinkedHere = false;
	$effect(() => {
		if (open) untrack(() => (unlinkedHere = false));
	});

	// A refetch (after a stale 400/409) can show the entry is no longer linked:
	// the clears-user copy would then describe an action that does nothing.
	$effect(() => {
		if (open && record && outcome === null && !unlinkedHere) {
			untrack(() => {
				toast.info(m['memberRegister.unlinkNothingToDo']());
				onClose();
			});
		}
	});

	async function run(id: string) {
		const result = await unlinkRecord(slug, accessToken, id);
		unlinkedHere = true;
		return result;
	}
	const description = $derived(
		outcome === 'reverse_merge'
			? m['memberRegister.unlinkReverseMerge']()
			: outcome === 'cancels_access'
				? m['memberRegister.unlinkCancelsAccessDescription']()
				: m['memberRegister.unlinkClearsUser']()
	);
</script>

{#snippet warning()}
	{#if outcome === 'cancels_access'}
		<Alert variant="destructive" data-testid="unlink-access-warning">
			<TriangleAlert class="h-4 w-4" aria-hidden="true" />
			<AlertDescription>{m['memberRegister.unlinkCancelsAccessWarning']()}</AlertDescription>
		</Alert>
	{/if}
{/snippet}

<!-- 400 (nothing to unlink) also refreshes the row: it changed under the admin. -->
<ConfirmRecordDialog
	{open}
	{record}
	{recordPresent}
	{slug}
	{onClose}
	action="unlink"
	staleOn400
	{run}
	title={m['memberRegister.unlinkTitle']({ name: record?.full_name ?? '' })}
	{description}
	confirmLabel={m['memberRegister.unlinkConfirm']()}
	confirmVariant={outcome === 'cancels_access' ? 'destructive' : 'default'}
	body={warning}
	successMessage={() => m['memberRegister.unlinkedToast']()}
/>
