<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';

	/**
	 * "Mark as issued" for one skipped invoice / credit note (#1008): asks for
	 * the document's number in the organizer's own system. The parent owns the
	 * request; `onSave` resolves once the list has refreshed, and rejects with
	 * the message to show (the backend's 422 `detail`, or a fallback).
	 *
	 * On close, focus goes back to the row's action via `returnFocus`, which the
	 * parent resolves after the refetch: the row may have left the list.
	 */
	interface Props {
		open: boolean;
		/** e.g. "Invoice · E2E Business BE", names the document being resolved. */
		subject: string;
		initialReference: string;
		onSave: (reference: string) => Promise<void>;
		onOpenChange: (open: boolean) => void;
		returnFocus: () => void;
	}

	const { open, subject, initialReference, onSave, onOpenChange, returnFocus }: Props = $props();

	const uid = $props.id();
	let reference = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Fresh form each time the dialog opens (runs as the content mounts).
	function reset() {
		reference = initialReference;
		error = null;
		saving = false;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = reference.trim();
		if (!trimmed) {
			error = m['compliance.skipped.referenceRequired']();
			return;
		}
		error = null;
		saving = true;
		try {
			await onSave(trimmed);
			onOpenChange(false);
		} catch (err) {
			error = err instanceof Error ? err.message : m['compliance.skipped.saveFailed']();
		} finally {
			saving = false;
		}
	}
</script>

<Dialog {open} onOpenChange={(v) => !saving && onOpenChange(v)}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto"
		onOpenAutoFocus={reset}
		onCloseAutoFocus={(e) => {
			e.preventDefault();
			returnFocus();
		}}
	>
		<DialogHeader>
			<DialogTitle>{m['compliance.skipped.markIssued']()}</DialogTitle>
			<DialogDescription>
				<span class="block font-medium text-foreground">{subject}</span>
				{m['compliance.skipped.resolveDescription']()}
			</DialogDescription>
		</DialogHeader>
		<form class="space-y-4" onsubmit={submit} novalidate>
			<div class="space-y-2">
				<Label for="{uid}-reference">{m['compliance.skipped.referenceLabel']()}</Label>
				<Input
					id="{uid}-reference"
					bind:value={reference}
					maxlength={255}
					autocomplete="off"
					aria-invalid={error ? 'true' : undefined}
					aria-describedby="{uid}-hint{error ? ` ${uid}-error` : ''}"
				/>
				<p id="{uid}-hint" class="text-xs text-muted-foreground">
					{m['compliance.skipped.referenceHint']()}
				</p>
			</div>
			{#if error}
				<div
					id="{uid}-error"
					role="alert"
					class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{error}</p>
				</div>
			{/if}
			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					onclick={() => onOpenChange(false)}
					disabled={saving}
				>
					{m['common.cancel']()}
				</Button>
				<Button type="submit" disabled={saving}>
					{#if saving}<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{/if}
					{m['compliance.skipped.save']()}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
