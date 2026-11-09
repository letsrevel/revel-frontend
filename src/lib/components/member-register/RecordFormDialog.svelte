<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import type { MembershipRecordSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
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
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import {
		createRecord,
		inviteRecord,
		memberRegisterKeys,
		updateRecord
	} from '$lib/member-register/api';
	import { getEditability } from '$lib/member-register/editability';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import {
		EMPTY_FORM,
		buildCreateBody,
		buildUpdateBody,
		formValuesFromRecord,
		normalizeLocalInput,
		reconcileAfterStale,
		validateRecordForm,
		type FormErrorCode,
		type FormErrors,
		type RecordFormValues
	} from '$lib/member-register/form-values';
	import { SELECT_CLASS } from '$lib/member-register/ui';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		/** null = create a new entry; a record = edit it. */
		record: MembershipRecordSchema | null;
		slug: string;
		accessToken: string | null;
		/** STANDARD tiers only: the backend refuses any other tier on create/edit. */
		tiers: MembershipTierSchema[];
		/** False once a refetch shows the edited entry is gone from the list. */
		recordPresent?: boolean;
		onClose: () => void;
	}

	const { open, record, slug, accessToken, tiers, recordPresent = true, onClose }: Props = $props();

	const queryClient = useQueryClient();
	const mode = $derived(record ? 'edit' : 'create');
	const editability = $derived(record ? getEditability(record) : undefined);

	let values = $state<RecordFormValues>({ ...EMPTY_FORM });
	let original = $state<RecordFormValues>({ ...EMPTY_FORM });
	let fieldErrors = $state<FormErrors>({});
	let submitError = $state<DescribedError | null>(null);
	// Create mode only: send the claim invite right after the entry is added.
	let sendInvite = $state(false);
	let seededFor: string | null = null;

	// Seed once per opening (and per record), never on a background refetch of the
	// same record: that would wipe what the user typed.
	$effect(() => {
		if (!open) {
			seededFor = null;
			return;
		}
		const key = record?.id ?? 'new';
		if (seededFor === key) return;
		seededFor = key;
		untrack(() => {
			const seed = record ? formValuesFromRecord(record) : { ...EMPTY_FORM };
			values = { ...seed };
			original = { ...seed };
			fieldErrors = {};
			submitError = null;
			sendInvite = false;
		});
	});

	let inviteFailed = false;
	// An invite needs an address to send to; the backend refuses future starts too.
	const canSendInvite = $derived(mode === 'create' && values.email.trim() !== '');

	const mutation = createMutation(() => ({
		mutationFn: async (): Promise<MembershipRecordSchema> => {
			if (record && editability) {
				return updateRecord(
					slug,
					accessToken,
					record.id ?? '',
					buildUpdateBody(original, values, editability)
				);
			}
			const created = await createRecord(slug, accessToken, buildCreateBody(values));
			// The entry exists from here on: a failed invite must not fail the create
			// (a retry would add a duplicate), so it is reported separately.
			if (canSendInvite && sendInvite && created.id) {
				try {
					await inviteRecord(slug, accessToken, created.id);
				} catch {
					inviteFailed = true;
				}
			}
			return created;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
			toast.success(
				mode === 'edit' ? m['memberRegister.savedEdit']() : m['memberRegister.savedCreate']()
			);
			if (inviteFailed) {
				inviteFailed = false;
				toast.error(m['memberPeople.inviteAfterCreateFailed']());
			}
			onClose();
		},
		onError: async (error: unknown) => {
			submitError = describeRegisterError(error, 'save');
			if (submitError.stale) await resyncAfterStale();
		}
	}));

	// The entry changed under us (e.g. it was linked): reload, then rebuild the form
	// from the fresh record so locked fields reflect reality. Edits survive only on
	// fields that are still editable; anything dropped is reported, never silent.
	async function resyncAfterStale() {
		await queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
		await tick();
		if (!recordPresent) {
			toast.info(m['memberRegister.recordGone']());
			onClose();
			return;
		}
		if (!record) return;
		const fresh = formValuesFromRecord(record);
		const { values: next, dropped } = reconcileAfterStale(
			original,
			values,
			fresh,
			getEditability(record)
		);
		original = { ...fresh };
		values = { ...next };
		fieldErrors = {};
		const droppedText = dropped.length
			? m['memberRegister.droppedLocked']({
					fields: dropped
						.map((f) =>
							f === 'tier'
								? m['memberRegister.fieldTier']()
								: m['memberRegister.fieldValidUntilShort']()
						)
						.join(', ')
				})
			: null;
		const prev = submitError;
		submitError = {
			stale: false,
			message: prev?.message ?? m['memberRegister.errorStale'](),
			detail: [prev?.detail, m['memberRegister.changedReview'](), droppedText]
				.filter(Boolean)
				.join(' ')
		};
	}

	function errorText(code: FormErrorCode | undefined): string {
		switch (code) {
			case 'nameRequired':
				return m['memberRegister.errNameRequired']();
			case 'nameTooLong':
				return m['memberRegister.errNameTooLong']();
			case 'emailInvalid':
				return m['memberRegister.errEmailInvalid']();
			case 'tierRequired':
				return m['memberRegister.errTierRequired']();
			case 'validFromRequired':
				return m['memberRegister.errValidFromRequired']();
			case 'validFromFuture':
				return m['memberRegister.errValidFromFuture']();
			case 'rangeInvalid':
				return m['memberRegister.errRangeInvalid']();
			case 'noReopen':
				return m['memberRegister.errNoReopen']();
			default:
				return '';
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitError = null;
		// Normalise once, where values enter the form state (seed and submit).
		values.validFrom = normalizeLocalInput(values.validFrom);
		values.validUntil = normalizeLocalInput(values.validUntil);
		fieldErrors = validateRecordForm(values, {
			mode,
			...(editability ? { editability, original } : {})
		});
		if (Object.keys(fieldErrors).length > 0) return;
		mutation.mutate();
	}

	function handleOpenChange(next: boolean) {
		if (!next && !mutation.isPending) onClose();
	}

	const tierLocked = $derived(editability?.tierLocked ?? false);
	const validUntilLocked = $derived(editability?.validUntilLocked ?? false);
	const lockedTierName = $derived(record?.tier_name ?? '');
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>
				{mode === 'edit' ? m['memberRegister.editTitle']() : m['memberRegister.createTitle']()}
			</DialogTitle>
			<DialogDescription>
				{mode === 'edit'
					? m['memberRegister.editDescription']()
					: m['memberRegister.createDescription']()}
			</DialogDescription>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4" novalidate>
			{#if editability?.linkedOpen}
				<p
					class="rounded-md border border-border bg-muted p-3 text-sm text-foreground"
					data-testid="linked-entry-note"
				>
					{m['memberRegister.linkedEditNote']()}
				</p>
			{/if}

			<div class="space-y-2">
				<Label for="rf-name">{m['memberRegister.fieldName']()}</Label>
				<Input
					id="rf-name"
					bind:value={values.fullName}
					maxlength={255}
					autocomplete="off"
					aria-invalid={fieldErrors.fullName ? 'true' : undefined}
					aria-describedby={fieldErrors.fullName ? 'rf-name-err' : undefined}
				/>
				{#if fieldErrors.fullName}
					<p id="rf-name-err" class="text-sm text-destructive">{errorText(fieldErrors.fullName)}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="rf-email">{m['memberRegister.fieldEmail']()}</Label>
				<Input
					id="rf-email"
					type="email"
					bind:value={values.email}
					autocomplete="off"
					aria-invalid={fieldErrors.email ? 'true' : undefined}
					aria-describedby={fieldErrors.email ? 'rf-email-err' : undefined}
				/>
				{#if fieldErrors.email}
					<p id="rf-email-err" class="text-sm text-destructive">{errorText(fieldErrors.email)}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="rf-tier">{m['memberRegister.fieldTier']()}</Label>
				<select
					id="rf-tier"
					class={SELECT_CLASS}
					bind:value={values.tierId}
					disabled={tierLocked}
					aria-invalid={fieldErrors.tierId ? 'true' : undefined}
					aria-describedby="rf-tier-help{fieldErrors.tierId ? ' rf-tier-err' : ''}"
				>
					{#if tierLocked}
						<option value={values.tierId}>{lockedTierName}</option>
					{:else}
						<option value="" disabled>{m['memberRegister.tierPlaceholder']()}</option>
						{#each tiers as tier (tier.id ?? tier.name)}
							{#if tier.id}<option value={tier.id}>{tier.name}</option>{/if}
						{/each}
					{/if}
				</select>
				<p id="rf-tier-help" class="text-xs text-muted-foreground">
					{#if editability?.tierLockReason === 'linked'}
						{m['memberRegister.tierLockedLinked']()}
					{:else if editability?.tierLockReason === 'day-member'}
						{m['memberRegister.tierLockedDay']()}
					{:else}
						{m['memberRegister.tierHelp']()}
					{/if}
				</p>
				{#if fieldErrors.tierId}
					<p id="rf-tier-err" class="text-sm text-destructive">{errorText(fieldErrors.tierId)}</p>
				{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="rf-from">{m['memberRegister.fieldValidFrom']()}</Label>
					<Input
						id="rf-from"
						type="datetime-local"
						bind:value={values.validFrom}
						aria-invalid={fieldErrors.validFrom ? 'true' : undefined}
						aria-describedby="rf-from-read{fieldErrors.validFrom ? ' rf-from-err' : ''}"
					/>
					<p id="rf-from-read" class="min-h-4 text-xs text-muted-foreground">
						{formatDateTimeReadback(values.validFrom)}
					</p>
					{#if fieldErrors.validFrom}
						<p id="rf-from-err" class="text-sm text-destructive">
							{errorText(fieldErrors.validFrom)}
						</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="rf-until">{m['memberRegister.fieldValidUntil']()}</Label>
					<Input
						id="rf-until"
						type="datetime-local"
						bind:value={values.validUntil}
						disabled={validUntilLocked}
						required={editability?.reopenBlocked ?? false}
						aria-invalid={fieldErrors.validUntil ? 'true' : undefined}
						aria-describedby="rf-until-read rf-until-help{fieldErrors.validUntil
							? ' rf-until-err'
							: ''}"
					/>
					<p id="rf-until-read" class="min-h-4 text-xs text-muted-foreground">
						{formatDateTimeReadback(values.validUntil)}
					</p>
					<p id="rf-until-help" class="text-xs text-muted-foreground">
						{#if validUntilLocked}
							{m['memberRegister.validUntilLockedLinked']()}
						{:else if editability?.reopenBlocked}
							{m['memberRegister.validUntilNoReopen']()}
						{:else}
							{m['memberRegister.validUntilHelp']()}
						{/if}
					</p>
					{#if fieldErrors.validUntil}
						<p id="rf-until-err" class="text-sm text-destructive">
							{errorText(fieldErrors.validUntil)}
						</p>
					{/if}
				</div>
			</div>

			{#if canSendInvite}
				<div class="flex items-start gap-2">
					<Checkbox id="rf-send-invite" bind:checked={sendInvite} class="mt-0.5" />
					<div class="space-y-1">
						<Label for="rf-send-invite">{m['memberPeople.sendInvite']()}</Label>
						<p class="text-xs text-muted-foreground">{m['memberPeople.sendInviteHelp']()}</p>
					</div>
				</div>
			{/if}

			{#if submitError}
				<RegisterErrorAlert error={submitError} />
			{/if}

			<DialogFooter class="gap-2 sm:gap-0">
				<Button type="button" variant="outline" onclick={onClose} disabled={mutation.isPending}>
					{m['memberRegister.cancel']()}
				</Button>
				<Button type="submit" disabled={mutation.isPending}>
					{#if mutation.isPending}
						<Loader2 class="animate-spin" aria-hidden="true" />
					{/if}
					{mode === 'edit' ? m['memberRegister.save']() : m['memberRegister.create']()}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
