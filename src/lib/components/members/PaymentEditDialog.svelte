<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsUpdateSubscriptionPayment } from '$lib/api/generated/sdk.gen';
	import type {
		MembershipPaymentStatus,
		MembershipPaymentUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from '@lucide/svelte';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';
	import EditableStatusSelect from './EditableStatusSelect.svelte';
	import {
		PaymentRefusedError,
		invalidatePaymentCaches,
		isEditableStatus,
		isTerminalSubscriptionStatus,
		toPaymentError,
		type EditablePayment
	} from './paymentEdit';

	interface Props {
		slug: string;
		payment: EditablePayment | null;
		open: boolean;
		onClose: () => void;
		/**
		 * The owning subscription's status when the caller knows it (the drawer does;
		 * the org-wide ledger rows carry no subscription status). It only decides which
		 * reason the lock hint gives.
		 */
		subscriptionStatus?: string | null;
	}

	const { slug, payment, open, onClose, subscriptionStatus }: Props = $props();
	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	let amount = $state('');
	let status = $state<MembershipPaymentStatus>('succeeded');
	let occurredAt = $state('');
	// Whether the admin actually touched the date field. The picker drops seconds, so
	// comparing the value alone could report a change nobody made.
	let dateTouched = $state(false);
	let notes = $state('');
	let formError = $state<string | null>(null);

	// The date the row shows today: `occurred_at` is the real-world payment date,
	// `created_at` only when the row was written.
	const originalDate = $derived(payment ? (payment.occurred_at ?? payment.created_at) : '');

	$effect(() => {
		if (open && payment) {
			amount = String(payment.amount);
			status = payment.status;
			dateTouched = false;
			occurredAt = payment.occurred_at ?? payment.created_at;
			notes = payment.notes ?? '';
			formError = null;
		}
	});

	// Status and date move the subscription's billing period. The backend contract
	// (revel-backend#1366) says `can_void` also gates the status/occurred_at fields:
	// it is true only for the LATEST payment of a non-terminal subscription.
	const periodFieldsEditable = $derived(!!payment?.can_void);
	// A refunded/voided row has no editable status: keep the field on its real value.
	const statusEditable = $derived(
		periodFieldsEditable && !!payment && isEditableStatus(payment.status)
	);

	// Why the period fields are locked. `can_void` is false for a payment that is not
	// the latest AND for a terminal subscription, so name the reason only when known.
	const lockHint = $derived(
		isTerminalSubscriptionStatus(subscriptionStatus)
			? m['orgAdmin.members.subscriptions.editPayment.lockedHintEnded']()
			: subscriptionStatus
				? m['orgAdmin.members.subscriptions.editPayment.lockedHint']()
				: m['orgAdmin.members.subscriptions.editPayment.lockedHintAny']()
	);

	const MINUTE_MS = 60_000;
	/** The picker works at minute precision, so compare there. */
	function sameMinute(a: string, b: string): boolean {
		return (
			Math.floor(new Date(a).getTime() / MINUTE_MS) ===
			Math.floor(new Date(b).getTime() / MINUTE_MS)
		);
	}

	// The date is required once the admin has touched it: clearing it is an error,
	// never silently ignored.
	const dateError = $derived(
		periodFieldsEditable && dateTouched && !occurredAt
			? m['orgAdmin.members.subscriptions.editPayment.dateRequired']()
			: undefined
	);

	// `bind:value` on a number input hands back a number, or null once the field is
	// cleared (the same shape the sibling numeric forms guard against).
	const amountText = $derived(amount === null || amount === undefined ? '' : String(amount).trim());

	/** Only the fields that actually changed: an unchanged status or date is never resent. */
	const changes = $derived.by((): MembershipPaymentUpdateSchema => {
		const body: MembershipPaymentUpdateSchema = {};
		if (!payment) return body;
		if (amountText !== '' && Number(amountText) !== Number(payment.amount))
			body.amount = amountText;
		if (notes !== (payment.notes ?? '')) body.notes = notes;
		if (periodFieldsEditable) {
			if (statusEditable && status !== payment.status) body.status = status;
			if (dateTouched && occurredAt && !sameMinute(occurredAt, originalDate))
				body.occurred_at = occurredAt;
		}
		return body;
	});
	const hasChanges = $derived(Object.keys(changes).length > 0 && !dateError);

	const editMut = createMutation(() => ({
		mutationFn: async (body: MembershipPaymentUpdateSchema) => {
			if (!payment?.id) throw new Error(m['orgAdmin.members.subscriptions.editPayment.error']());
			const res = await organizationadminsubscriptionsUpdateSubscriptionPayment({
				path: { slug, payment_id: payment.id },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw toPaymentError(res.error, m['orgAdmin.members.subscriptions.editPayment.error']());
			return res.data;
		},
		onSuccess: () => {
			invalidatePaymentCaches(queryClient, slug);
			toast.success(m['orgAdmin.members.subscriptions.editPayment.saved']());
			onClose();
		},
		onError: (err: Error) => {
			if (err instanceof PaymentRefusedError) {
				// The row is no longer eligible: refresh it (its action disappears)
				// and say why, instead of leaving a form that can only fail again.
				invalidatePaymentCaches(queryClient, slug);
				toast.error(err.message);
				onClose();
				return;
			}
			// 400 (future date, lapsed period, ...) carries a translated `detail`:
			// keep the form open so the value can be corrected.
			formError = err.message;
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!hasChanges || editMut.isPending) return;
		formError = null;
		editMut.mutate(changes);
	}
</script>

<Dialog
	bind:open={
		() => open,
		(v: boolean) => {
			if (!v && !editMut.isPending) onClose();
		}
	}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.editPayment.title']()}</DialogTitle>
		</DialogHeader>

		{#if payment}
			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="ep-amt">{m['orgAdmin.members.subscriptions.editPayment.amount']()}</Label>
						<Input id="ep-amt" type="number" min="0" step="0.01" bind:value={amount} required />
					</div>
					<div class="space-y-1">
						<Label for="ep-cur">{m['orgAdmin.members.subscriptions.editPayment.currency']()}</Label>
						<Input
							id="ep-cur"
							value={payment.currency}
							readonly
							aria-describedby="ep-cur-hint"
							class="bg-muted"
						/>
					</div>
				</div>
				<p id="ep-cur-hint" class="-mt-2 text-xs text-muted-foreground">
					{m['orgAdmin.members.subscriptions.editPayment.currencyLocked']()}
				</p>

				<div class="space-y-1">
					<Label for="ep-status">{m['orgAdmin.members.subscriptions.editPayment.status']()}</Label>
					<EditableStatusSelect
						id="ep-status"
						bind:value={status}
						disabled={!statusEditable}
						describedBy={periodFieldsEditable ? undefined : 'ep-locked-hint'}
					/>
				</div>

				<div class="space-y-1">
					<DateTimePicker
						id="ep-occurred"
						bind:value={occurredAt}
						disabled={!periodFieldsEditable}
						error={dateError}
						describedBy={periodFieldsEditable ? undefined : 'ep-locked-hint'}
						onValueChange={() => (dateTouched = true)}
						label={m['orgAdmin.members.subscriptions.editPayment.occurredAt']()}
					/>
					{#if !periodFieldsEditable}
						<p id="ep-locked-hint" class="text-xs text-muted-foreground">
							{lockHint}
						</p>
					{/if}
				</div>

				<div class="space-y-1">
					<Label for="ep-notes">{m['orgAdmin.members.subscriptions.editPayment.notes']()}</Label>
					<Textarea id="ep-notes" bind:value={notes} rows={2} />
				</div>

				{#if formError}
					<p role="alert" class="text-sm text-destructive">{formError}</p>
				{/if}

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={onClose} disabled={editMut.isPending}>
						{m['tierForm.cancel']()}
					</Button>
					<Button type="submit" disabled={!hasChanges || editMut.isPending}>
						{#if editMut.isPending}<Loader2
								class="mr-2 h-4 w-4 animate-spin"
								aria-hidden="true"
							/>{/if}
						{m['orgAdmin.members.subscriptions.editPayment.submit']()}
					</Button>
				</div>
			</form>
		{/if}
	</DialogContent>
</Dialog>
