<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsReviveSubscription } from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		OrganizationAdminDetailSchema,
		RevivalRequestSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from '@lucide/svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';
	import { backendMessage } from '$lib/utils/api-error-detail';

	interface Props {
		sub: SubscriptionSchema;
		/** Non-null id from the drawer — `sub.id` is optional in the generated schema. */
		subId: string;
		organization: OrganizationAdminDetailSchema;
		open: boolean;
		onClose: () => void;
		onSuccess: () => void;
	}

	const { sub, subId, organization, open, onClose, onSuccess }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	// ONLINE revival mints a Stripe Checkout the MEMBER completes — staff cannot
	// pay on their behalf, so the online shape collects nothing.
	const isOnline = $derived(sub.plan.payment_method === 'online');
	// Locked to the plan: the revival payment settles the plan's own price.
	const currency = $derived(sub.plan.currency);
	const currencyLabel = $derived(
		CURRENCY_OPTIONS.find((opt) => opt.value === currency)?.label ?? currency
	);

	let amount = $state('0.00');
	let notes = $state('');

	$effect(() => {
		if (open) {
			amount = String(sub.plan.price ?? '0.00');
			notes = '';
		}
	});

	const reviveMut = createMutation(() => ({
		mutationFn: async (body: RevivalRequestSchema) => {
			const res = await organizationadminsubscriptionsReviveSubscription({
				path: { slug: organization.slug, sub_id: subId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				// The backend's refusals (revival window closed, plan sold out, member
				// banned) are the source of truth — surface them verbatim. The 400 is
				// `ValidationErrorResponse | ErrorDetail` and a negative `amount` is a
				// request-validation 422 whose `detail` is a LIST, so probe rather than
				// read: the old `(res.error as {message?})` cast named a field that was
				// already undefined at runtime (backend #824).
				throw new Error(backendMessage(res.error) ?? 'Failed to revive subscription');
			}
			return res.data;
		},
		onSuccess: () => {
			toast.success(
				isOnline
					? m['orgAdmin.members.subscriptions.drawer.reviveOnlineDone']()
					: m['orgAdmin.members.subscriptions.drawer.reviveDone']()
			);
			onSuccess();
			onClose();
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();
		reviveMut.mutate(
			isOnline ? {} : { amount, currency: currency as RevivalRequestSchema['currency'], notes }
		);
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>
				{isOnline
					? m['orgAdmin.members.subscriptions.drawer.reviveOnlineTitle']()
					: m['orgAdmin.members.subscriptions.drawer.reviveOfflineTitle']()}
			</DialogTitle>
			<DialogDescription class="mt-1">
				{isOnline
					? m['orgAdmin.members.subscriptions.drawer.reviveOnlineBody']()
					: m['orgAdmin.members.subscriptions.drawer.reviveOfflineBody']()}
			</DialogDescription>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			{#if !isOnline}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="revive-amt">
							{m['orgAdmin.members.subscriptions.recordPayment.amount']()}
						</Label>
						<Input id="revive-amt" type="number" min="0" step="0.01" bind:value={amount} required />
					</div>
					<div class="space-y-1">
						<Label for="revive-cur">
							{m['orgAdmin.members.subscriptions.recordPayment.currency']()}
						</Label>
						<Input id="revive-cur" value={currencyLabel} readonly />
					</div>
				</div>

				<div class="space-y-1">
					<Label for="revive-notes">
						{m['orgAdmin.members.subscriptions.recordPayment.notes']()}
					</Label>
					<Textarea id="revive-notes" bind:value={notes} rows={2} />
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={reviveMut.isPending}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={reviveMut.isPending}>
					{#if reviveMut.isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{isOnline
						? m['orgAdmin.members.subscriptions.drawer.reviveOnlineTitle']()
						: m['orgAdmin.members.subscriptions.drawer.revive']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
