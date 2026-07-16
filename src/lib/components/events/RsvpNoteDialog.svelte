<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { cn } from '$lib/utils/cn';
	import type { RsvpStatus } from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		answer: RsvpStatus;
		/** The user's currently stored note. Every submission overwrites the note
		 * wholesale server-side, so an unedited dialog must resubmit it as-is. */
		initialNote: string;
		isSubmitting: boolean;
		onConfirm: (note: string) => void;
		onCancel: () => void;
	}

	let { open, answer, initialNote, isSubmitting, onConfirm, onCancel }: Props = $props();

	const MAX_NOTE_LENGTH = 500;
	let note = $state('');

	// Reseed from the stored note every time the dialog opens — submitting an
	// empty textarea clears a previously saved note, so prefill is load-bearing.
	$effect(() => {
		if (open) note = initialNote;
	});

	const answerLabel = $derived.by(() => {
		if (answer === 'yes') return m['rsvpNoteDialog.answerYes']();
		if (answer === 'maybe') return m['rsvpNoteDialog.answerMaybe']();
		return m['rsvpNoteDialog.answerNo']();
	});

	// The confirm CTA mirrors the RSVP button the user clicked: same label
	// ("RSVP Yes/Maybe/No") and the selected-state color of RSVPButtons.
	const confirmLabel = $derived.by(() => {
		if (answer === 'yes') return m['rsvpNoteDialog.confirmYes']();
		if (answer === 'maybe') return m['rsvpNoteDialog.confirmMaybe']();
		return m['rsvpNoteDialog.confirmNo']();
	});

	const confirmClasses = $derived(
		cn(
			answer === 'yes' &&
				'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:text-white dark:hover:bg-green-600',
			answer === 'maybe' &&
				'bg-yellow-500 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:text-white dark:hover:bg-yellow-700',
			answer === 'no' &&
				'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-600'
		)
	);
</script>

<Dialog.Root {open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m['rsvpNoteDialog.title']()}</Dialog.Title>
			<Dialog.Description>
				{m['rsvpNoteDialog.description']({ answer: answerLabel })}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2 py-2">
			<Label for="rsvp-note">{m['rsvpNoteDialog.noteLabel']()}</Label>
			<Textarea
				id="rsvp-note"
				bind:value={note}
				maxlength={MAX_NOTE_LENGTH}
				rows={4}
				disabled={isSubmitting}
				placeholder={m['rsvpNoteDialog.notePlaceholder']()}
				aria-describedby="rsvp-note-counter"
			/>
			<p id="rsvp-note-counter" class="text-right text-xs text-muted-foreground" aria-live="polite">
				{m['rsvpNoteDialog.counter']({ count: note.length, max: MAX_NOTE_LENGTH })}
			</p>
		</div>

		<Dialog.Footer class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={onCancel} disabled={isSubmitting}>
				{m['rsvpNoteDialog.cancel']()}
			</Button>
			<Button onclick={() => onConfirm(note)} disabled={isSubmitting} class={confirmClasses}>
				{isSubmitting ? m['rsvpNoteDialog.submitting']() : confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
