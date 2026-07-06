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
	import DurationInput from '$lib/components/forms/DurationInput.svelte';
	import { Loader2 } from '@lucide/svelte';

	type Mode = 'issue' | 'reactivate';

	interface Props {
		open: boolean;
		onOpenChange: (v: boolean) => void;
		mode: Mode;
		userName: string;
		// Default duration in minutes. Caller passes parsed setting (or fallback).
		defaultMinutes: number;
		isPending: boolean;
		onConfirm: (expiresAt: string) => void;
	}

	let {
		open = $bindable(),
		onOpenChange,
		mode,
		userName,
		defaultMinutes,
		isPending,
		onConfirm
	}: Props = $props();

	let minutes = $state<number | null>(defaultMinutes);

	// When the dialog reopens for a different entry/offer the caller may pass a
	// new defaultMinutes; reset the editable copy on open transitions.
	let wasOpen = $state(false);
	$effect(() => {
		if (open && !wasOpen) {
			minutes = defaultMinutes;
		}
		wasOpen = open;
	});

	const titleKey = $derived(`orgAdmin.waitlist.offer.${mode}Dialog.title` as const);
	const descriptionKey = $derived(`orgAdmin.waitlist.offer.${mode}Dialog.description` as const);
	const confirmKey = $derived(`orgAdmin.waitlist.offer.${mode}Dialog.confirm` as const);

	function handleConfirm(): void {
		const safeMinutes =
			typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
				? Math.floor(minutes)
				: defaultMinutes;
		const expiresAt = new Date(Date.now() + safeMinutes * 60_000).toISOString();
		onConfirm(expiresAt);
	}

	function handleCancel(): void {
		onOpenChange(false);
	}
</script>

<Dialog bind:open onOpenChange={(v) => onOpenChange(v)}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>
				{m[titleKey]({ userName })}
			</DialogTitle>
			<DialogDescription>
				{m[descriptionKey]()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-1.5 py-2">
			<DurationInput
				bind:value={minutes}
				storageUnit="minutes"
				defaultUnit="hours"
				label={m['orgAdmin.waitlist.offer.expiryDialog.durationLabel']()}
				helpText={m['orgAdmin.waitlist.offer.expiryDialog.durationHelper']()}
				min={1}
			/>
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={handleCancel} disabled={isPending}>
				{m['common.cancel']()}
			</Button>
			<Button onclick={handleConfirm} disabled={isPending || !minutes || minutes <= 0}>
				{#if isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m[confirmKey]()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
