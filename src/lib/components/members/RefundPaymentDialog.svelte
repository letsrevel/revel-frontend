<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PaymentSchema2, RefundSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		payment: PaymentSchema2 | null;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: RefundSchema) => void;
		isSubmitting?: boolean;
	}

	const { payment, open, onClose, onSubmit, isSubmitting = false }: Props = $props();
	let notes = $state('');

	$effect(() => {
		if (open) notes = '';
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSubmit({ notes });
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.refund.title']()}</DialogTitle>
		</DialogHeader>
		<form onsubmit={handleSubmit} class="space-y-4">
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.members.subscriptions.refund.body']()}
			</p>
			{#if payment}
				<p class="text-sm">{payment.amount} {payment.currency}</p>
			{/if}
			<div class="space-y-1">
				<Label for="rf-notes">{m['orgAdmin.members.subscriptions.refund.notes']()}</Label>
				<Textarea id="rf-notes" bind:value={notes} rows={2} />
			</div>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.refund.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
