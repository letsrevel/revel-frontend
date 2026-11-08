<script lang="ts" generics="T">
	import { tick, untrack, type Snippet } from 'svelte';
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
	import { memberRegisterKeys, RegisterApiError } from '$lib/member-register/api';
	import {
		describeRegisterError,
		type DescribedError,
		type RegisterAction
	} from '$lib/member-register/errors';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	/**
	 * One-click confirm dialog for an action on a single register entry (invite,
	 * delete). Owns the mutation, the inline error, and the stale-row handling:
	 * on a stale failure the list is refetched and, if the entry is gone, the
	 * dialog closes with a toast.
	 */
	interface Props {
		open: boolean;
		record: MembershipRecordSchema | null;
		/** False once a refetch shows the entry is gone from the list. */
		recordPresent?: boolean;
		slug: string;
		onClose: () => void;
		/** The API call for the entry. */
		run: (recordId: string) => Promise<T>;
		/** Which copy set `describeRegisterError` uses. */
		action: RegisterAction;
		/**
		 * Treat a 400 as "the row is stale" too (refetch so its state refreshes; the
		 * backend's reason still shows inline). The invite endpoint answers 400, never
		 * 409, for linked / merged / email-less / revoked / future-dated rows.
		 */
		staleOn400?: boolean;
		title: string;
		description: string;
		confirmLabel: string;
		confirmVariant?: 'default' | 'destructive';
		/** Extra content between the description and the footer (e.g. a warning). */
		body?: Snippet;
		successMessage: (result: T) => string;
	}

	const {
		open,
		record,
		recordPresent = true,
		slug,
		onClose,
		run,
		action,
		staleOn400 = false,
		title,
		description,
		confirmLabel,
		confirmVariant = 'default',
		body,
		successMessage
	}: Props = $props();

	const queryClient = useQueryClient();
	let submitError = $state<DescribedError | null>(null);

	$effect(() => {
		if (open) untrack(() => (submitError = null));
	});

	const mutation = createMutation(() => ({
		mutationFn: () => {
			if (!record?.id) throw new Error('member-register: record without id');
			return run(record.id);
		},
		onSuccess: async (result: T) => {
			await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
			toast.success(successMessage(result));
			onClose();
		},
		onError: async (error: unknown) => {
			const described = describeRegisterError(error, action);
			submitError = described;
			const stale =
				described.stale ||
				(staleOn400 && error instanceof RegisterApiError && error.status === 400);
			if (stale) {
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
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>

			{@render body?.()}

			{#if submitError}
				<RegisterErrorAlert error={submitError} />
			{/if}

			<DialogFooter class="gap-2 sm:gap-0">
				<Button type="button" variant="outline" onclick={onClose} disabled={mutation.isPending}>
					{m['memberRegister.cancel']()}
				</Button>
				<Button
					type="button"
					variant={confirmVariant}
					disabled={mutation.isPending}
					onclick={() => {
						submitError = null;
						mutation.mutate();
					}}
				>
					{#if mutation.isPending}
						<Loader2 class="animate-spin" aria-hidden="true" />
					{/if}
					{confirmLabel}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
