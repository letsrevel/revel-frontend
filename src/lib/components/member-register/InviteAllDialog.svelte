<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { inviteAll, memberRegisterKeys } from '$lib/member-register/api';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		slug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	const { open, slug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();
	let submitError = $state<DescribedError | null>(null);

	$effect(() => {
		if (open) untrack(() => (submitError = null));
	});

	// The register list is paginated and filtered and the backend exposes no count of
	// eligible entries, so the confirm names no number; the real one comes back here.
	const mutation = createMutation(() => ({
		mutationFn: () => inviteAll(slug, accessToken),
		onSuccess: (invited: number) => {
			if (invited > 0) toast.success(m['memberRegister.inviteAllSent']({ invited }));
			else toast.info(m['memberRegister.inviteAllNone']());
			onClose();
			// Refresh in the background: nothing here waits on the list.
			void queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
		},
		onError: (error: unknown) => {
			submitError = describeRegisterError(error, 'invite-all');
		}
	}));

	function handleOpenChange(next: boolean) {
		if (!next && !mutation.isPending) onClose();
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['memberRegister.inviteAllTitle']()}</DialogTitle>
			<DialogDescription>{m['memberRegister.inviteAllDescription']()}</DialogDescription>
		</DialogHeader>

		<p class="text-sm text-muted-foreground" data-testid="invite-all-limit">
			{m['memberRegister.inviteAllLimitNote']()}
		</p>

		{#if submitError}
			<RegisterErrorAlert error={submitError} />
			{#if !submitError.throttled}
				<p class="text-sm text-muted-foreground" data-testid="invite-all-retry-note">
					{m['memberRegister.inviteAllRetryNote']()}
				</p>
			{/if}
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
				{submitError && !submitError.throttled
					? m['memberRegister.inviteAllRetryConfirm']()
					: m['memberRegister.inviteAllConfirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
