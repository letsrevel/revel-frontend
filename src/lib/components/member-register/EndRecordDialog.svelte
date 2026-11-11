<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { AlertTriangle, Loader2 } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import { endRecord, invalidateRegister, memberRegisterKeys } from '$lib/member-register/api';
	import { getEditability } from '$lib/member-register/editability';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import {
		buildEndBody,
		validateEndForm,
		type EndErrorCode,
		type EndFormValues
	} from '$lib/member-register/form-values';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		record: MembershipRecordSchema | null;
		/** False once a refetch shows the entry is gone from the list. */
		recordPresent?: boolean;
		slug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	const { open, record, recordPresent = true, slug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();
	const cancelsMembership = $derived(record ? getEditability(record).endCancelsMembership : false);

	let values = $state<EndFormValues>({ reason: 'cancelled', validUntil: '' });
	let dateError = $state<EndErrorCode | null>(null);
	let submitError = $state<DescribedError | null>(null);

	$effect(() => {
		if (open) {
			untrack(() => {
				values = { reason: 'cancelled', validUntil: '' };
				dateError = null;
				submitError = null;
			});
		}
	});

	const mutation = createMutation(() => ({
		mutationFn: () => {
			if (!record?.id) throw new Error('member-register: record without id');
			return endRecord(slug, accessToken, record.id, buildEndBody(values));
		},
		onSuccess: async () => {
			// Ending a linked open entry removes it from the pairing side of the scan.
			await invalidateRegister(queryClient, slug, true);
			toast.success(m['memberRegister.endedToast']());
			onClose();
		},
		onError: async (error: unknown) => {
			submitError = describeRegisterError(error, 'end');
			if (submitError.stale) {
				await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
				await tick();
				if (!recordPresent) {
					toast.info(m['memberRegister.recordGone']());
					onClose();
				}
			}
		}
	}));

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitError = null;
		if (!record) return;
		dateError = validateEndForm(values, record, { linked: cancelsMembership });
		if (dateError) return;
		mutation.mutate();
	}

	function handleOpenChange(next: boolean) {
		if (!next && !mutation.isPending) onClose();
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		{#if record}
			<DialogHeader>
				<DialogTitle>{m['memberRegister.endTitle']({ name: record.full_name })}</DialogTitle>
				<DialogDescription>{m['memberRegister.endDescription']()}</DialogDescription>
			</DialogHeader>

			<form onsubmit={handleSubmit} class="space-y-4" novalidate>
				{#if cancelsMembership}
					<Alert variant="destructive" data-testid="end-linked-warning">
						<AlertTriangle class="h-4 w-4" aria-hidden="true" />
						<AlertDescription class="font-medium">
							{m['memberRegister.endLinkedWarning']()}
						</AlertDescription>
					</Alert>
				{/if}

				<fieldset class="space-y-2">
					<legend class="text-sm font-medium">{m['memberRegister.endReasonLabel']()}</legend>
					<label class="flex items-center gap-2 text-sm">
						<input type="radio" name="end-reason" value="cancelled" bind:group={values.reason} />
						{m['memberRegister.endReasonCancelled']()}
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="radio" name="end-reason" value="removed" bind:group={values.reason} />
						{m['memberRegister.endReasonRemoved']()}
					</label>
				</fieldset>

				<div class="space-y-2">
					<Label for="end-until">{m['memberRegister.endDateLabel']()}</Label>
					<Input
						id="end-until"
						type="datetime-local"
						bind:value={values.validUntil}
						aria-invalid={dateError ? 'true' : undefined}
						aria-describedby="end-until-read end-until-help{dateError ? ' end-until-err' : ''}"
					/>
					<p id="end-until-read" class="min-h-4 text-xs text-muted-foreground">
						{formatDateTimeReadback(values.validUntil)}
					</p>
					<p id="end-until-help" class="text-xs text-muted-foreground">
						{cancelsMembership
							? m['memberRegister.endDateHelpLinked']()
							: m['memberRegister.endDateHelp']()}
					</p>
					{#if dateError}
						<p id="end-until-err" class="text-sm text-destructive">
							{dateError === 'future'
								? m['memberRegister.errEndFuture']()
								: m['memberRegister.errEndBeforeStart']()}
						</p>
					{/if}
				</div>

				{#if submitError}
					<RegisterErrorAlert error={submitError} />
				{/if}

				<DialogFooter class="gap-2 sm:gap-0">
					<Button type="button" variant="outline" onclick={onClose} disabled={mutation.isPending}>
						{m['memberRegister.cancel']()}
					</Button>
					<Button
						type="submit"
						variant={cancelsMembership ? 'destructive' : 'default'}
						disabled={mutation.isPending}
					>
						{#if mutation.isPending}
							<Loader2 class="animate-spin" aria-hidden="true" />
						{/if}
						{cancelsMembership
							? m['memberRegister.endConfirmLinked']()
							: m['memberRegister.endConfirm']()}
					</Button>
				</DialogFooter>
			</form>
		{/if}
	</DialogContent>
</Dialog>
