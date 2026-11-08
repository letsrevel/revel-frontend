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
	 * Saving an empty note deletes it (after an in-app confirmation).
	 */
	interface Props {
		open: boolean;
		slug: string;
		/** The person the note is about. */
		userId: string;
		displayName: string;
		accessToken: string | null | undefined;
		onClose: () => void;
	}

	const { open, slug, userId, displayName, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();

	let draft = $state('');
	let seededKey = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);

	const noteQuery = createQuery(() => ({
		queryKey: userNoteKey(slug, userId),
		queryFn: () => fetchUserNote(slug, userId, accessToken),
		enabled: open && !!accessToken && !!userId,
		// A staff note is edited by other staff too; never reuse a stale copy
		// as the editor's starting point.
		staleTime: 0,
		gcTime: 0
	}));

	const existing = $derived(noteQuery.data ?? null);

	// Seed the editable copy once per (open, person) when the note has loaded.
	$effect(() => {
		if (!open) {
			seededKey = null;
			return;
		}
		const key = `${slug}:${userId}`;
		if (noteQuery.isSuccess && seededKey !== key) {
			draft = noteQuery.data?.body ?? '';
			seededKey = key;
			errorMessage = null;
		}
	});

	const counter = $derived(noteCounter(draft));
	const isEmpty = $derived(draft.trim().length === 0);

	function refreshAfterWrite(): void {
		queryClient.invalidateQueries({ queryKey: userNoteKey(slug, userId) });
		// The members list carries `private_note`; refresh its indicator.
		queryClient.invalidateQueries({ queryKey: membersListKey(slug) });
	}

	function failure(err: unknown): string {
		return (
			(err instanceof Error ? err.message : null) ??
			extractApiErrorDetail(err) ??
			m['userNote.saveError']()
		);
	}

	const saveMutation = createMutation(() => ({
		mutationFn: (body: string) => saveUserNote(slug, userId, body, accessToken),
		onSuccess: () => {
			toast.success(m['userNote.saved']());
			refreshAfterWrite();
			onClose();
		},
		onError: (err: unknown) => {
			errorMessage = failure(err);
		}
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: () => deleteUserNote(slug, userId, accessToken),
		onSuccess: () => {
			toast.success(m['userNote.deleted']());
			confirmDeleteOpen = false;
			refreshAfterWrite();
			onClose();
		},
		onError: (err: unknown) => {
			confirmDeleteOpen = false;
			errorMessage = failure(err);
		}
	}));

	const busy = $derived(saveMutation.isPending || deleteMutation.isPending);
	const canSave = $derived(
		noteQuery.isSuccess && !busy && counter.state !== 'over' && (existing !== null || !isEmpty)
	);

	function submit(): void {
		if (!canSave) return;
		errorMessage = null;
		if (isEmpty) {
			// An empty note is a deletion; never do that without asking.
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

<Dialog {open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
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
			<form
				class="space-y-3"
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
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
			</form>
		{/if}

		<DialogFooter class="gap-2 sm:justify-between">
			{#if existing}
				<Button
					type="button"
					variant="outline"
					class="text-destructive"
					onclick={() => (confirmDeleteOpen = true)}
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
			<DialogDescription>{m['userNote.deleteMessage']()}</DialogDescription>
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
