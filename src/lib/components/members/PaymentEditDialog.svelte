<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsUpdateSubscriptionPayment } from '$lib/api/generated/sdk.gen';
	import type { MembershipPaymentUpdateSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from '@lucide/svelte';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';
	import {
		PaymentRefusedError,
		invalidatePaymentCaches,
		toPaymentError,
		type EditablePayment
	} from './paymentEdit';

	interface Props {
		slug: string;
		payment: EditablePayment | null;
		open: boolean;
		onClose: () => void;
	}

	type EditableStatus = 'pending' | 'succeeded' | 'failed';

	const { slug, payment, open, onClose }: Props = $props();
	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	let amount = $state('');
	let status = $state<EditableStatus>('succeeded');
	let occurredAt = $state('');
	let notes = $state('');
	let formError = $state<string | null>(null);

	// The date the row shows today: `occurred_at` is the real-world payment date,
	// `created_at` only when the row was written.
	const originalDate = $derived(payment ? (payment.occurred_at ?? payment.created_at) : '');

	$effect(() => {
		if (open && payment) {
			amount = String(payment.amount);
			status = (
				['pending', 'succeeded', 'failed'].includes(payment.status) ? payment.status : 'succeeded'
			) as EditableStatus;
			occurredAt = payment.occurred_at ?? payment.created_at;
			notes = payment.notes ?? '';
			formError = null;
		}
	});

	// Status and date move the subscription's billing period, which the backend
	// only allows on the latest payment (`can_void` carries that rule).
	const periodFieldsEditable = $derived(!!payment?.can_void);

	function sameInstant(a: string, b: string): boolean {
		return new Date(a).getTime() === new Date(b).getTime();
	}

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
			if (status !== payment.status) body.status = status;
			if (occurredAt && !sameInstant(occurredAt, originalDate)) body.occurred_at = occurredAt;
		}
		return body;
	});
	const hasChanges = $derived(Object.keys(changes).length > 0);

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

<Dialog {open} onOpenChange={(v: boolean) => (!v && !editMut.isPending ? onClose() : null)}>
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
					<select
						id="ep-status"
						bind:value={status}
						disabled={!periodFieldsEditable}
						aria-describedby={periodFieldsEditable ? undefined : 'ep-locked-hint'}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<option value="succeeded">
							{m['orgAdmin.members.subscriptions.recordPayment.statusOption.succeeded']()}
						</option>
						<option value="pending">
							{m['orgAdmin.members.subscriptions.recordPayment.statusOption.pending']()}
						</option>
						<option value="failed">
							{m['orgAdmin.members.subscriptions.recordPayment.statusOption.failed']()}
						</option>
					</select>
				</div>

				<div class="space-y-1">
					<DateTimePicker
						id="ep-occurred"
						bind:value={occurredAt}
						disabled={!periodFieldsEditable}
						label={m['orgAdmin.members.subscriptions.editPayment.occurredAt']()}
					/>
					{#if !periodFieldsEditable}
						<p id="ep-locked-hint" class="text-xs text-muted-foreground">
							{m['orgAdmin.members.subscriptions.editPayment.lockedHint']()}
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
