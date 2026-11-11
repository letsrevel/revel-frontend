<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { inviteRecord } from '$lib/member-register/api';
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

	// Snapshot at open time: a resend flips invite_status to 'invited' mid-flight and
	// must not change the copy of the dialog that is closing.
	let isResend = $state(false);
	$effect(() => {
		if (open) untrack(() => (isResend = record?.invite_status === 'invited'));
	});

	const name = $derived(record?.full_name ?? '');
	const email = $derived(record?.email ?? '');
</script>

<!-- staleOn400: this endpoint answers 400 (never 409) for linked / merged / email-less /
     revoked / future-dated / temporary / ended rows, so any 400 refreshes the list. -->
<ConfirmRecordDialog
	{open}
	{record}
	{recordPresent}
	{slug}
	{onClose}
	action="invite"
	staleOn400
	run={(id) => inviteRecord(slug, accessToken, id)}
	title={isResend
		? m['memberRegister.resendInviteTitle']({ name })
		: m['memberRegister.inviteTitle']({ name })}
	description={isResend
		? m['memberRegister.resendInviteDescription']({ email })
		: m['memberRegister.inviteDescription']({ name, email })}
	confirmLabel={isResend
		? m['memberRegister.resendInviteConfirm']()
		: m['memberRegister.inviteConfirm']()}
	successMessage={(updated: MembershipRecordSchema) =>
		m['memberRegister.inviteSentToast']({ email: updated.email ?? '' })}
/>
