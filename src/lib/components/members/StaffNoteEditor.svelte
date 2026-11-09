<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { createConfirm } from '$lib/components/common/confirm.svelte';
	import type { UserNoteSchema } from '$lib/api/generated/types.gen';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import { formatDateTime } from '$lib/utils/date';
	import { memberRegisterKeys } from '$lib/member-register/api';
	import {
		NOTE_MAX_LENGTH,
		deleteNote,
		fetchNote,
		membersListKey,
		noteCounter,
		noteKey,
		saveNote,
		type NoteTarget
	} from './user-note';

	/**
	 * Inline editor for the private organizer note about one person (#1165).
	 *
	 * `target` says which route it talks to: the person's own note (`user`) or a
	 * register entry's note (`record`; for a linked entry the backend proxies it to
	 * the user's note, so it is the same note the members area shows).
	 *
	 * Callers must only mount this for viewers holding `manage_members`: the
	 * endpoints refuse everyone else. One mount = one editing session. Saving an
	 * empty note deletes it (after an in-app confirmation).
	 */
	interface Props {
		slug: string;
		target: NoteTarget;
		accessToken: string | null | undefined;
		/** Show the section heading and privacy hint. A host that has its own title (a dialog) hides them. */
		showHeader?: boolean;
		/** Called after a save or a delete went through (a dialog host closes itself here). */
		onChanged?: () => void;
	}

	const { slug, target, accessToken, showHeader = true, onChanged }: Props = $props();

	const queryClient = useQueryClient();
	const confirmation = createConfirm();

	let draft = $state('');
	// Plain (non-reactive) flag: the draft is seeded exactly once per mount.
	let seeded = false;
	let errorMessage = $state<string | null>(null);

	const key = $derived(noteKey(slug, target));

	const noteQuery = createQuery(() => ({
		queryKey: key,
		queryFn: () => fetchNote(slug, target, accessToken),
		enabled: !!accessToken,
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

	/** The members list carries `private_note`; the register rows carry `has_note`. */
	function refreshIndicators(): void {
		void queryClient.invalidateQueries({ queryKey: membersListKey(slug) });
		void queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
	}

	const saveMutation = createMutation(() => ({
		mutationFn: (body: string) => saveNote(slug, target, body, accessToken),
		onSuccess: (saved: UserNoteSchema) => {
			toast.success(m['userNote.saved']());
			// The PUT response is the new note: no refetch.
			queryClient.setQueryData(key, saved);
			draft = saved.body;
			refreshIndicators();
			onChanged?.();
		},
		onError: (err: unknown) => {
			errorMessage = failure(err, m['userNote.saveError']());
		}
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: () => deleteNote(slug, target, accessToken),
		onSuccess: () => {
			toast.success(m['userNote.deleted']());
			queryClient.setQueryData(key, null);
			draft = '';
			refreshIndicators();
			onChanged?.();
		},
		onError: (err: unknown) => {
			errorMessage = failure(err, m['userNote.deleteError']());
		}
	}));

	const busy = $derived(saveMutation.isPending || deleteMutation.isPending);
	const dirty = $derived(draft !== (existing?.body ?? ''));
	const canSave = $derived(
		noteQuery.isSuccess &&
			!busy &&
			counter.state !== 'over' &&
			dirty &&
			(existing !== null || !isEmpty)
	);

	/** Asks first, always: deleting a note is permanent. */
	async function confirmDelete(reason: 'empty-save' | 'explicit'): Promise<void> {
		errorMessage = null;
		const ok = await confirmation.ask({
			title: m['userNote.deleteTitle'](),
			message:
				reason === 'empty-save'
					? m['userNote.deleteMessage']()
					: m['userNote.deleteExplicitMessage'](),
			confirmLabel: m['userNote.deleteConfirm'](),
			destructive: true
		});
		if (ok) deleteMutation.mutate();
	}

	function submit(): void {
		if (!canSave) return;
		errorMessage = null;
		if (isEmpty) {
			// An empty note is a deletion; never do that without asking.
			void confirmDelete('empty-save');
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

<section
	aria-labelledby={showHeader ? 'staff-note-heading' : undefined}
	class="space-y-3"
	data-testid="staff-note"
>
	{#if showHeader}
		<SectionHeader
			id="staff-note-heading"
			level={3}
			title={m['memberPeople.sheet.noteHeading']()}
			subtitle={m['userNote.hint']()}
		/>
	{/if}

	{#if noteQuery.isPending}
		<div class="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['userNote.loading']()}
		</div>
	{:else if noteQuery.isError}
		<p class="py-2 text-sm text-destructive" role="alert">{m['userNote.loadError']()}</p>
	{:else}
		<div class="space-y-3">
			<MarkdownEditor
				id="staff-note-body"
				label={m['userNote.label']()}
				placeholder={m['userNote.placeholder']()}
				rows={6}
				disabled={busy}
				bind:value={draft}
			/>

			<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
				<p class="text-muted-foreground">{lastEdited ?? m['userNote.noNoteYet']()}</p>
				<p
					class={counter.state === 'over' ? 'font-bold text-destructive' : 'text-muted-foreground'}
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

			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
				{#if existing}
					<Button
						type="button"
						variant="outline"
						class="text-destructive"
						onclick={() => confirmDelete('explicit')}
						disabled={busy}
					>
						{m['userNote.deleteButton']()}
					</Button>
				{:else}
					<span></span>
				{/if}
				<Button type="button" onclick={submit} disabled={!canSave}>
					{#if saveMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['userNote.save']()}
				</Button>
			</div>
		</div>
	{/if}
</section>

<ConfirmDialog {...confirmation.dialogProps} />
