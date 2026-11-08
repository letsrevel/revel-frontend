<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { inviteRecord, memberRegisterKeys } from '$lib/member-register/api';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

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

	const queryClient = useQueryClient();
	let submitError = $state<DescribedError | null>(null);
	// Snapshot at open time: a resend flips invite_status to 'invited' mid-flight and
	// must not change the copy of the dialog that is closing.
	let isResend = $state(false);

	$effect(() => {
		if (open) {
			untrack(() => {
				submitError = null;
				isResend = record?.invite_status === 'invited';
			});
		}
	});

	const mutation = createMutation(() => ({
		mutationFn: () => {
			if (!record?.id) throw new Error('member-register: record without id');
			return inviteRecord(slug, accessToken, record.id);
		},
		onSuccess: async (updated: MembershipRecordSchema) => {
			// Refetch so the row shows the fresh invited_at / status.
			await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
			toast.success(m['memberRegister.inviteSentToast']({ email: updated.email ?? '' }));
			onClose();
		},
		onError: async (error: unknown) => {
			submitError = describeRegisterError(error, 'invite');
			// 400 carries the backend's reason inline; 404/409 mean the list is stale.
			if (submitError.stale) {
				await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
				await tick();
				if (!recordPresent) {
					toast.info(m['memberRegister.recordGone']());
					onClose();
				}
			}
		}
	}));

	function handleOpenChange(next: boolean) {
		if (!next && !mutation.isPending) onClose();
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		{#if record}
			<DialogHeader>
				<DialogTitle>
					{isResend
						? m['memberRegister.resendInviteTitle']({ name: record.full_name })
						: m['memberRegister.inviteTitle']({ name: record.full_name })}
				</DialogTitle>
				<DialogDescription>
					{isResend
						? m['memberRegister.resendInviteDescription']({ email: record.email ?? '' })
						: m['memberRegister.inviteDescription']({
								name: record.full_name,
								email: record.email ?? ''
							})}
				</DialogDescription>
			</DialogHeader>

			{#if submitError}
				<RegisterErrorAlert error={submitError} />
			{/if}

			<DialogFooter class="gap-2 sm:gap-0">
				<Button type="button" variant="outline" onclick={onClose} disabled={mutation.isPending}>
					{m['memberRegister.cancel']()}
				</Button>
				<Button
					type="button"
					disabled={mutation.isPending}
					onclick={() => {
						submitError = null;
						mutation.mutate();
					}}
				>
					{#if mutation.isPending}
						<Loader2 class="animate-spin" aria-hidden="true" />
					{/if}
					{isResend
						? m['memberRegister.resendInviteConfirm']()
						: m['memberRegister.inviteConfirm']()}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
