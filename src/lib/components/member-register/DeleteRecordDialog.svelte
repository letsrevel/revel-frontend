<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { deleteRecord } from '$lib/member-register/api';
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
</script>

<!-- 409 = "remove the member first" (or merged entries still attached): shown inline, not stale. -->
<ConfirmRecordDialog
	{open}
	{record}
	{recordPresent}
	{slug}
	{onClose}
	action="delete"
	run={(id) => deleteRecord(slug, accessToken, id)}
	title={m['memberRegister.deleteTitle']({ name: record?.full_name ?? '' })}
	description={m['memberRegister.deleteDescription']()}
	confirmLabel={m['memberRegister.deleteConfirm']()}
	confirmVariant="destructive"
	successMessage={() => m['memberRegister.deletedToast']()}
/>
