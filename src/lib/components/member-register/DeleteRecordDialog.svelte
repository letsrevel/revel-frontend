<script lang="ts">
	import { untrack } from 'svelte';
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
	import { deleteRecord, memberRegisterKeys } from '$lib/member-register/api';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		record: MembershipRecordSchema | null;
		slug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	const { open, record, slug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();
	let submitError = $state<DescribedError | null>(null);

	$effect(() => {
		if (open) untrack(() => (submitError = null));
	});

	const mutation = createMutation(() => ({
		mutationFn: () => {
			if (!record?.id) throw new Error('member-register: record without id');
			return deleteRecord(slug, accessToken, record.id);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
			toast.success(m['memberRegister.deletedToast']());
			onClose();
		},
		onError: async (error: unknown) => {
			// 409 = "remove the member first" (or merged entries still attached): shown inline.
			submitError = describeRegisterError(error, 'delete');
			if (submitError.stale) {
				await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
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
				<DialogTitle>{m['memberRegister.deleteTitle']({ name: record.full_name })}</DialogTitle>
				<DialogDescription>{m['memberRegister.deleteDescription']()}</DialogDescription>
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
					variant="destructive"
					disabled={mutation.isPending}
					onclick={() => {
						submitError = null;
						mutation.mutate();
					}}
				>
					{#if mutation.isPending}
						<Loader2 class="animate-spin" aria-hidden="true" />
					{/if}
					{m['memberRegister.deleteConfirm']()}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
