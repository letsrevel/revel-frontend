<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
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
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import type { UserNoteSchema } from '$lib/api/generated/types.gen';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import { formatDateTime } from '$lib/utils/date';
	import {
		NOTE_MAX_LENGTH,
		deleteUserNote,
		fetchUserNote,
		membersListKey,
		noteCounter,
		saveUserNote,
		userNoteKey
	} from './user-note';

	/**
	 * Editor for the private organizer note about one person (#1165).
	 *
	 * Callers must only mount this for viewers holding `manage_members`: the
	 * endpoints refuse everyone else, and the control should not exist for them.
	 * It is mounted conditionally (one mount = one editing session) and always open.
	 * Saving an empty note deletes it (after an in-app confirmation).
	 */
	interface Props {
		slug: string;
		/** The person the note is about. */
		userId: string;
		displayName: string;
		accessToken: string | null | undefined;
		onClose: () => void;
	}

	const { slug, userId, displayName, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();

	let draft = $state('');
	// Plain (non-reactive) flag: the draft is seeded exactly once per mount.
	let seeded = false;
	let errorMessage = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);
	/** Why the confirmation is open decides its copy: an empty save or the explicit button. */
	let confirmReason = $state<'empty-save' | 'explicit'>('explicit');

	const noteQuery = createQuery(() => ({
		queryKey: userNoteKey(slug, userId),
		queryFn: () => fetchUserNote(slug, userId, accessToken),
		enabled: !!accessToken && !!userId,
		// A staff note is edited by other staff too; never reuse a stale copy
		// as the editor's starting point.
		staleTime: 0,
		gcTime: 0
	}));

	const existing = $derived(noteQuery.data ?? null);

	// Seed the editable copy once, when the note has loaded.
	$effect(() => {
		if (noteQuery.isSuccess && !seeded) {
			seeded = true;
			draft = noteQuery.data?.body ?? '';
			errorMessage = null;
		}
	});

	const counter = $derived(noteCounter(draft));
	const isEmpty = $derived(draft.trim().length === 0);

	/** The backend's `detail` when it sent one; otherwise the localized fallback. Never raw `Error.message`. */
	function failure(err: unknown, fallback: string): string {
		return extractApiErrorDetail(err) ?? fallback;
	}

	const saveMutation = createMutation(() => ({
		mutationFn: (body: string) => saveUserNote(slug, userId, body, accessToken),
		onSuccess: (saved: UserNoteSchema) => {
			toast.success(m['userNote.saved']());
			// The PUT response is the new note: no refetch before the dialog unmounts.
			queryClient.setQueryData(userNoteKey(slug, userId), saved);
			// The members list carries `private_note`; refresh its indicator.
			queryClient.invalidateQueries({ queryKey: membersListKey(slug) });
			onClose();
		},
		onError: (err: unknown) => {
			errorMessage = failure(err, m['userNote.saveError']());
		}
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: () => deleteUserNote(slug, userId, accessToken),
		onSuccess: () => {
			toast.success(m['userNote.deleted']());
			confirmDeleteOpen = false;
			queryClient.removeQueries({ queryKey: userNoteKey(slug, userId) });
			queryClient.invalidateQueries({ queryKey: membersListKey(slug) });
			onClose();
		},
		onError: (err: unknown) => {
			confirmDeleteOpen = false;
			errorMessage = failure(err, m['userNote.deleteError']());
		}
	}));

	const busy = $derived(saveMutation.isPending || deleteMutation.isPending);
	const canSave = $derived(
		noteQuery.isSuccess && !busy && counter.state !== 'over' && (existing !== null || !isEmpty)
	);

	function askToDelete(): void {
		errorMessage = null;
		confirmReason = 'explicit';
		confirmDeleteOpen = true;
	}

	function submit(): void {
		if (!canSave) return;
		errorMessage = null;
		if (isEmpty) {
			// An empty note is a deletion; never do that without asking.
			confirmReason = 'empty-save';
			confirmDeleteOpen = true;
			return;
		}
		saveMutation.mutate(draft);
	}

	const lastEdited = $derived.by(() => {
		if (!existing) return null;
		const date = formatDateTime(existing.updated_at);
		return existing.updated_by_name
			? m['userNote.lastEdited']({ name: existing.updated_by_name, date })
			: m['userNote.lastEditedFormerStaff']({ date });
	});

	// Screen readers hear the counter only when it matters (near / over the cap).
	const counterAnnouncement = $derived(
		counter.state === 'over'
			? m['userNote.counterOver']({ over: counter.over })
			: counter.state === 'near'
				? m['userNote.counterNear']({ remaining: counter.remaining })
				: ''
	);
</script>

<Dialog open={true} onOpenChange={(value) => (!value ? onClose() : undefined)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<DialogHeader>
			<DialogTitle>{m['userNote.title']({ name: displayName })}</DialogTitle>
			<DialogDescription>{m['userNote.hint']()}</DialogDescription>
		</DialogHeader>

		{#if noteQuery.isPending}
			<div class="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['userNote.loading']()}
			</div>
		{:else if noteQuery.isError}
			<p class="py-4 text-sm text-destructive" role="alert">{m['userNote.loadError']()}</p>
		{:else}
			<div class="space-y-3">
				<MarkdownEditor
					id="user-note-body"
					label={m['userNote.label']()}
					placeholder={m['userNote.placeholder']()}
					rows={8}
					disabled={busy}
					bind:value={draft}
				/>

				<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
					<p class="text-muted-foreground">{lastEdited ?? m['userNote.noNoteYet']()}</p>
					<p
						class={counter.state === 'over'
							? 'font-bold text-destructive'
							: 'text-muted-foreground'}
					>
						{m['userNote.counter']({ count: counter.count, max: NOTE_MAX_LENGTH })}
					</p>
				</div>
				<p class="sr-only" aria-live="polite" data-testid="note-counter-live">
					{counterAnnouncement}
				</p>

				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}
			</div>
		{/if}

		<DialogFooter class="gap-2 sm:justify-between">
			{#if existing}
				<Button
					type="button"
					variant="outline"
					class="text-destructive"
					onclick={askToDelete}
					disabled={busy}
				>
					{m['userNote.deleteButton']()}
				</Button>
			{:else}
				<span></span>
			{/if}
			<div class="flex flex-col-reverse gap-2 sm:flex-row">
				<Button type="button" variant="ghost" onclick={onClose} disabled={busy}>
					{m['common.cancel']()}
				</Button>
				<Button type="button" onclick={submit} disabled={!canSave}>
					{#if saveMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['userNote.save']()}
				</Button>
			</div>
		</DialogFooter>
	</DialogContent>
</Dialog>

<Dialog open={confirmDeleteOpen} onOpenChange={(value) => (confirmDeleteOpen = value)}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>{m['userNote.deleteTitle']()}</DialogTitle>
			<DialogDescription>
				{confirmReason === 'empty-save'
					? m['userNote.deleteMessage']()
					: m['userNote.deleteExplicitMessage']()}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="gap-2">
			<Button
				type="button"
				variant="ghost"
				onclick={() => (confirmDeleteOpen = false)}
				disabled={deleteMutation.isPending}
			>
				{m['common.cancel']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={() => deleteMutation.mutate()}
				disabled={deleteMutation.isPending}
			>
				{#if deleteMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['userNote.deleteConfirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
