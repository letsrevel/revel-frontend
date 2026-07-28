<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SubscriptionSchema, CancelSubscriptionSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { AlertTriangle, Loader2 } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		subscription: SubscriptionSchema;
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: CancelSubscriptionSchema) => void;
		isSubmitting?: boolean;
	}

	const { subscription, open, onClose, onSubmit, isSubmitting = false }: Props = $props();

	let mode = $state<'period_end' | 'immediate'>('period_end');
	let immediateAck = $state(false);

	$effect(() => {
		if (open) {
			mode = 'period_end';
			immediateAck = false;
		}
	});

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}

	const canSubmit = $derived(mode === 'period_end' || immediateAck);

	// `cancel_online_subscription` releases the Stripe schedule before either
	// cancel branch, which clears `pending_plan` — so the warning applies to both
	// modes. Only the ONLINE scheduled-downgrade path ever sets `pending_plan_id`,
	// so this stays hidden for every offline subscription.
	const hasPendingSwitch = $derived(!!subscription.pending_plan_id);

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!canSubmit) return;
		onSubmit({ immediate: mode === 'immediate' });
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.cancel.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<RadioGroup bind:value={mode as string}>
				<div class="flex items-start gap-2">
					<RadioGroupItem id="cancel-pe" value="period_end" />
					<div>
						<Label for="cancel-pe">
							{m['orgAdmin.members.subscriptions.cancel.atPeriodEnd']({
								date: fmtDate(subscription.current_period_end)
							})}
						</Label>
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.members.subscriptions.cancel.atPeriodEndDesc']()}
						</p>
					</div>
				</div>
				<div class="flex items-start gap-2">
					<RadioGroupItem id="cancel-im" value="immediate" />
					<div>
						<Label for="cancel-im">{m['orgAdmin.members.subscriptions.cancel.immediate']()}</Label>
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.members.subscriptions.cancel.immediateDesc']()}
						</p>
					</div>
				</div>
			</RadioGroup>

			{#if hasPendingSwitch}
				<p class="flex gap-2 text-xs text-muted-foreground">
					<AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
					{m['orgAdmin.members.subscriptions.cancel.pendingSwitchDropped']()}
				</p>
			{/if}

			{#if mode === 'immediate'}
				<div class="flex items-center gap-2">
					<Checkbox
						id="cancel-ack"
						checked={immediateAck}
						onCheckedChange={(c) => (immediateAck = c === true)}
					/>
					<Label for="cancel-ack">
						{m['orgAdmin.members.subscriptions.cancel.immediateConfirm']()}
					</Label>
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					{m['orgAdmin.members.subscriptions.cancel.keep']()}
				</Button>
				<Button type="submit" disabled={isSubmitting || !canSubmit}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.cancel.confirm']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
