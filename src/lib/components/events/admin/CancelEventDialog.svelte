<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { invalidateAll } from '$app/navigation';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventadmincoreUpdateEventStatus } from '$lib/api/generated/sdk.gen';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Loader2, AlertTriangle, Info, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	const REASON_MAX_LENGTH = 1000;

	interface Props {
		open: boolean;
		eventId: string;
		/** Called once the event has been cancelled successfully. */
		onCancelled?: (event: EventDetailSchema) => void;
	}

	let { open = $bindable(), eventId, onCancelled }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let reason = $state('');

	$effect(() => {
		if (open) {
			reason = '';
		}
	});

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('not-authenticated');
			const trimmed = reason.trim();
			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: eventId, status: 'cancelled' },
				body: trimmed ? { cancellation_reason: trimmed } : null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error) || 'cancel-failed');
			}
			return response.data;
		},
		onSuccess: async (data) => {
			toast.success(m['cancelEvent.successTitle'](), {
				description: m['cancelEvent.successDescription'](),
				duration: 6000
			});
			queryClient.invalidateQueries({ queryKey: ['events'] });
			// Refresh the SvelteKit load functions so callers driven by
			// data.event(s) (admin events list, edit page) reflect the new
			// cancelled status without a full page reload.
			await invalidateAll();
			open = false;
			onCancelled?.(data);
		},
		onError: (err: Error) => {
			toast.error(m['cancelEvent.errorTitle'](), {
				description: extractErrorMessage(err) || undefined,
				duration: 6000
			});
		}
	}));

	function handleClose(): void {
		if (cancelMutation.isPending) return;
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] max-w-md overflow-y-auto"
		escapeKeydownBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
		interactOutsideBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<X class="h-5 w-5 text-destructive" aria-hidden="true" />
				{m['cancelEvent.dialogTitle']()}
			</DialogTitle>
			<DialogDescription>{m['cancelEvent.dialogDescription']()}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<Alert>
				<Info class="h-4 w-4" aria-hidden="true" />
				<AlertDescription>{m['cancelEvent.sharedNotice']()}</AlertDescription>
			</Alert>

			<div>
				<Label for="event-cancel-reason">{m['cancelEvent.reasonLabel']()}</Label>
				<Textarea
					id="event-cancel-reason"
					bind:value={reason}
					maxlength={REASON_MAX_LENGTH}
					rows={4}
					placeholder={m['cancelEvent.reasonPlaceholder']()}
					disabled={cancelMutation.isPending}
				/>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['cancelEvent.reasonHelp']({ max: REASON_MAX_LENGTH })}
				</p>
			</div>
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={handleClose} disabled={cancelMutation.isPending}>
				{m['cancelEvent.keepButton']()}
			</Button>
			<Button
				variant="destructive"
				onclick={() => cancelMutation.mutate()}
				disabled={cancelMutation.isPending}
			>
				{#if cancelMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['cancelEvent.cancelling']()}
				{:else}
					<AlertTriangle class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['cancelEvent.confirmButton']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
