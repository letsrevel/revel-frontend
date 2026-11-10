<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsVoidSubscriptionPayment } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { AlertTriangle, Loader2 } from '@lucide/svelte';
	import {
		PaymentRefusedError,
		invalidatePaymentCaches,
		paymentContext,
		toPaymentError,
		type EditablePayment
	} from './paymentEdit';

	interface Props {
		slug: string;
		payment: EditablePayment | null;
		open: boolean;
		onClose: () => void;
	}

	const { slug, payment, open, onClose }: Props = $props();
	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	let notes = $state('');
	let formError = $state<string | null>(null);

	$effect(() => {
		if (open) {
			notes = '';
			formError = null;
		}
	});

	const context = $derived(payment ? paymentContext(payment) : null);

	const voidMut = createMutation(() => ({
		mutationFn: async (reason: string) => {
			if (!payment?.id) throw new Error(m['orgAdmin.members.subscriptions.voidPayment.error']());
			const res = await organizationadminsubscriptionsVoidSubscriptionPayment({
				path: { slug, payment_id: payment.id },
				// The reason is optional: send a body only when there is one.
				body: reason ? { notes: reason } : undefined,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw toPaymentError(res.error, m['orgAdmin.members.subscriptions.voidPayment.error']());
			return res.data;
		},
		onSuccess: () => {
			invalidatePaymentCaches(queryClient, slug);
			// Voiding recomputes the period (and may drop the subscription back to
			// pending), so the confirmation says so: the row vanishing is not enough.
			toast.success(m['orgAdmin.members.subscriptions.voidPayment.done']());
			onClose();
		},
		onError: (err: Error) => {
			if (err instanceof PaymentRefusedError) {
				invalidatePaymentCaches(queryClient, slug);
				toast.error(err.message);
				onClose();
				return;
			}
			formError = err.message;
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (voidMut.isPending) return;
		formError = null;
		voidMut.mutate(notes.trim());
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v && !voidMut.isPending ? onClose() : null)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.voidPayment.title']()}</DialogTitle>
		</DialogHeader>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="flex gap-3 text-sm text-muted-foreground">
				<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
				<div class="space-y-1">
					<p>{m['orgAdmin.members.subscriptions.voidPayment.body']()}</p>
					{#if context}
						<p class="font-medium tabular-nums text-foreground">
							{context.amount} · {context.date}
						</p>
					{/if}
				</div>
			</div>
			<div class="space-y-1">
				<Label for="vp-notes">{m['orgAdmin.members.subscriptions.voidPayment.reason']()}</Label>
				<Textarea id="vp-notes" bind:value={notes} rows={2} />
			</div>
			{#if formError}
				<p role="alert" class="text-sm text-destructive">{formError}</p>
			{/if}
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={voidMut.isPending}>
					{m['orgAdmin.members.subscriptions.voidPayment.keep']()}
				</Button>
				<Button type="submit" variant="destructive" disabled={voidMut.isPending}>
					{#if voidMut.isPending}<Loader2
							class="mr-2 h-4 w-4 animate-spin"
							aria-hidden="true"
						/>{/if}
					{m['orgAdmin.members.subscriptions.voidPayment.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
