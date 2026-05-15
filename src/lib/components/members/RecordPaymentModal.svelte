<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SubscriptionSchema, PaymentRecordSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from 'lucide-svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';

	interface Props {
		subscription: SubscriptionSchema;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: PaymentRecordSchema) => void;
		isSubmitting?: boolean;
	}

	const { subscription, open, onClose, onSubmit, isSubmitting = false }: Props = $props();

	let amount = $state('0.00');
	let currency = $state<string>('EUR');
	let status = $state<'succeeded' | 'pending' | 'failed'>('succeeded');
	let notes = $state('');
	let occurredAt = $state('');

	$effect(() => {
		if (open) {
			amount = String(subscription.plan.price ?? '0.00');
			currency = subscription.plan.currency ?? 'EUR';
			status = 'succeeded';
			notes = '';
			occurredAt = '';
		}
	});

	const currencyWarning = $derived(currency !== subscription.plan.currency);

	function handleSubmit(e: Event) {
		e.preventDefault();
		const payload: PaymentRecordSchema = {
			amount,
			currency: currency as PaymentRecordSchema['currency'],
			status,
			notes
		};
		if (occurredAt) {
			// datetime-local gives us "YYYY-MM-DDTHH:mm"; backend expects ISO8601
			payload.occurred_at = new Date(occurredAt).toISOString();
		}
		onSubmit(payload);
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.recordPayment.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="rp-amt">{m['orgAdmin.members.subscriptions.recordPayment.amount']()}</Label>
					<Input id="rp-amt" type="number" min="0" step="0.01" bind:value={amount} required />
				</div>
				<div class="space-y-1">
					<Label for="rp-cur">{m['orgAdmin.members.subscriptions.recordPayment.currency']()}</Label>
					<select
						id="rp-cur"
						bind:value={currency}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{#each CURRENCY_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if currencyWarning}
				<p class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
					{m['orgAdmin.members.subscriptions.recordPayment.currencyWarning']({
						planCurrency: subscription.plan.currency,
						selected: currency
					})}
				</p>
			{/if}

			<div class="space-y-1">
				<Label for="rp-status">{m['orgAdmin.members.subscriptions.recordPayment.status']()}</Label>
				<select
					id="rp-status"
					bind:value={status}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
				<Label for="rp-occurred">
					{m['orgAdmin.members.subscriptions.recordPayment.occurredAt']()}
				</Label>
				<Input id="rp-occurred" type="datetime-local" bind:value={occurredAt} />
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.subscriptions.recordPayment.occurredAtHint']()}
				</p>
			</div>

			<div class="space-y-1">
				<Label for="rp-notes">{m['orgAdmin.members.subscriptions.recordPayment.notes']()}</Label>
				<Textarea id="rp-notes" bind:value={notes} rows={2} />
			</div>

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.recordPayment.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
