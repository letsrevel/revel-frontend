<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
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

	const effect = $derived(record ? unlinkEffect(record) : null);
	const description = $derived(
		effect === 'reverse_merge'
			? m['memberRegister.unlinkReverseMerge']()
			: effect === 'cancels_access'
				? m['memberRegister.unlinkCancelsAccessDescription']()
				: m['memberRegister.unlinkClearsUser']()
	);
</script>

{#snippet warning()}
	{#if effect === 'cancels_access'}
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
	run={(id) => unlinkRecord(slug, accessToken, id)}
	title={m['memberRegister.unlinkTitle']({ name: record?.full_name ?? '' })}
	{description}
	confirmLabel={m['memberRegister.unlinkConfirm']()}
	confirmVariant={effect === 'cancels_access' ? 'destructive' : 'default'}
	body={warning}
	successMessage={() => m['memberRegister.unlinkedToast']()}
/>
