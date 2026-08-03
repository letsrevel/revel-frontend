<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Loader2 } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { dashboardUpdateTicketGuestName, eventadminticketsUpdateTicketGuestName } from '$lib/api';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

	interface Props {
		open: boolean;
		ticketId: string;
		/** Admin mode: pass the event id to use the event-admin endpoint. */
		eventId?: string | null;
		/** Current holder name to prefill ('' when the ticket is nameless). */
		currentName: string;
		accessToken: string | null;
		onClose: () => void;
		/** Called after a successful rename — parent refreshes its data. */
		onRenamed: () => void;
	}

	const {
		open,
		ticketId,
		eventId = null,
		currentName,
		accessToken,
		onClose,
		onRenamed
	}: Props = $props();

	let name = $state('');
	let errorMessage = $state<string | null>(null);

	// Re-seed the editable copy each time the dialog opens for a ticket.
	let wasOpen = $state(false);
	$effect(() => {
		if (open && !wasOpen) {
			name = currentName;
			errorMessage = null;
		}
		wasOpen = open;
	});

	const renameMutation = createMutation(() => ({
		mutationFn: async (guestName: string) => {
			const headers = { Authorization: `Bearer ${accessToken}` };
			const response = eventId
				? await eventadminticketsUpdateTicketGuestName({
						path: { event_id: eventId, ticket_id: ticketId },
						body: { guest_name: guestName },
						headers
					})
				: await dashboardUpdateTicketGuestName({
						path: { ticket_id: ticketId },
						body: { guest_name: guestName },
						headers
					});
			if (response.error !== undefined || !response.data) {
				// 409: checked-in/cancelled; 400: clearing refused on a
				// names-required event. Errors are untyped in the generated
				// client, so branch on the HTTP status.
				const status = response.response?.status;
				const detail = extractApiErrorDetail(response.error);
				const message =
					status === 409
						? m['renameTicketDialog.errorConflict']()
						: (detail ?? m['renameTicketDialog.errorGeneric']());
				throw new Error(message);
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['renameTicketDialog.success']());
			onRenamed();
			onClose();
		},
		onError: (err: unknown) => {
			errorMessage = err instanceof Error ? err.message : m['renameTicketDialog.errorGeneric']();
		}
	}));

	function submit(): void {
		if (renameMutation.isPending) return;
		errorMessage = null;
		renameMutation.mutate(name.trim());
	}
</script>

<Dialog {open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>{m['renameTicketDialog.title']()}</DialogTitle>
			<DialogDescription>{m['renameTicketDialog.description']()}</DialogDescription>
		</DialogHeader>

		<form
			class="space-y-2 py-2"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<Label for="rename-holder-name">{m['renameTicketDialog.nameLabel']()}</Label>
			<Input
				id="rename-holder-name"
				type="text"
				bind:value={name}
				disabled={renameMutation.isPending}
				maxlength={255}
			/>
			<p class="text-xs text-muted-foreground">{m['renameTicketDialog.clearHint']()}</p>
			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}
		</form>

		<DialogFooter>
			<Button variant="ghost" onclick={onClose} disabled={renameMutation.isPending}>
				{m['common.cancel']()}
			</Button>
			<Button onclick={submit} disabled={renameMutation.isPending}>
				{#if renameMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['renameTicketDialog.save']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
