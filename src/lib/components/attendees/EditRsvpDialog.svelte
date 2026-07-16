<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getRsvpStatusColor, getRsvpStatusLabel } from '$lib/utils/status-colors';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { RsvpDetailSchema } from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		rsvp: RsvpDetailSchema | null;
		selectedStatus: 'yes' | 'maybe' | 'no';
		selectedNote: string;
		isPending: boolean;
		onSubmit: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		rsvp,
		selectedStatus = $bindable(),
		selectedNote = $bindable(),
		isPending,
		onSubmit,
		onCancel
	}: Props = $props();

	const hasChanges = $derived(
		rsvp !== null && (selectedStatus !== rsvp.status || selectedNote !== (rsvp.note ?? ''))
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m['attendeesAdmin.editModalTitle']()}</Dialog.Title>
			<Dialog.Description>
				{#if rsvp}
					{m['attendeesAdmin.editModalDescription']({ name: getUserDisplayName(rsvp.user) })}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if rsvp}
			<div class="space-y-4 py-4">
				<!-- Current info -->
				<div class="rounded-lg bg-muted p-3">
					<p class="text-sm font-medium">{m['attendeesAdmin.editModalCurrentStatus']()}</p>
					<p class="mt-1">
						<span
							class={cn(
								'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
								getRsvpStatusColor(rsvp.status)
							)}
						>
							{getRsvpStatusLabel(rsvp.status)}
						</span>
					</p>
				</div>

				<!-- New status selection -->
				<div class="space-y-2">
					<span id="edit-rsvp-status-label" class="text-sm font-medium"
						>{m['attendeesAdmin.editModalNewStatus']()}</span
					>
					<div class="space-y-2" role="radiogroup" aria-labelledby="edit-rsvp-status-label">
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="yes"
								bind:group={selectedStatus}
								class="h-4 w-4 text-green-600 focus:ring-green-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalYesLabel']()}</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="maybe"
								bind:group={selectedStatus}
								class="h-4 w-4 text-yellow-600 focus:ring-yellow-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalMaybeLabel']()}</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
						>
							<input
								type="radio"
								name="status"
								value="no"
								bind:group={selectedStatus}
								class="h-4 w-4 text-red-600 focus:ring-red-600"
							/>
							<span class="text-sm font-medium">{m['attendeesAdmin.editModalNoLabel']()}</span>
						</label>
					</div>
				</div>

				<!-- Note (sent on every update — prefilled so it is never cleared by accident) -->
				<div class="space-y-2">
					<Label for="edit-rsvp-note">{m['attendeesAdmin.noteFieldLabel']()}</Label>
					<Textarea
						id="edit-rsvp-note"
						bind:value={selectedNote}
						maxlength={500}
						rows={3}
						disabled={isPending}
						aria-describedby="edit-rsvp-note-counter"
					/>
					<p
						id="edit-rsvp-note-counter"
						class="text-right text-xs text-muted-foreground"
						aria-live="polite"
					>
						{m['rsvpNoteDialog.counter']({ count: selectedNote.length, max: 500 })}
					</p>
				</div>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={onCancel}>{m['attendeesAdmin.editModalCancel']()}</Button
				>
				<Button onclick={onSubmit} disabled={isPending || !hasChanges}>
					{isPending
						? m['attendeesAdmin.editModalUpdating']()
						: m['attendeesAdmin.editModalUpdate']()}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
