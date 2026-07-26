<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		mesubscriptionsCancelSubscription,
		organizationGetOrganization
	} from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { formatDate } from '$lib/utils/date';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		sub: MySubscriptionSchema;
	}
	const { open, onOpenChange, sub }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	const uid = $props.id();

	let mode = $state<'period_end' | 'immediate'>('period_end');
	let immediateConfirmed = $state(false);
	let errorMessage = $state<string | null>(null);

	// Refund policy is org-level and public; fetch it only while the dialog is
	// actually open so closed cards cost nothing.
	const orgQuery = createQuery(() => ({
		queryKey: ['org', sub.organization_slug, 'public-detail'],
		queryFn: async () => {
			const res = await organizationGetOrganization({ path: { slug: sub.organization_slug } });
			if (res.error || !res.data) throw new Error('Failed to load organization');
			return res.data;
		},
		enabled: open
	}));
	const refundPolicy = $derived(orgQuery.data?.membership_refund_policy?.trim() || null);

	function backendMessage(error: unknown): string | null {
		if (!error || typeof error !== 'object') return null;
		const body = error as { message?: unknown; detail?: unknown };
		if (typeof body.message === 'string' && body.message) return body.message;
		if (typeof body.detail === 'string' && body.detail) return body.detail;
		return null;
	}

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			errorMessage = null;
			const res = await mesubscriptionsCancelSubscription({
				path: { org_id: sub.organization_id },
				body: { immediate: mode === 'immediate' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['cancelSub.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['me', 'memberships'] });
			queryClient.invalidateQueries({ queryKey: ['me', 'subscriptions'] });
			queryClient.invalidateQueries({
				queryKey: ['me', 'org', sub.organization_id, 'subscription']
			});
			if (mode === 'immediate') {
				toast.success(m['cancelSub.successImmediate']());
			} else if (data.current_period_end) {
				toast.success(
					m['cancelSub.successPeriodEnd']({ date: formatDate(data.current_period_end) })
				);
			} else {
				toast.success(m['cancelSub.successPeriodEndNoDate']());
			}
			onOpenChange(false);
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['cancelSub.error']();
		}
	}));

	const isBusy = $derived(cancelMutation.isPending);
	// Every operand is read unconditionally: a short-circuiting expression would
	// leave the skipped one untracked once the guard flips.
	const canConfirm = $derived.by(() => {
		const busy = isBusy;
		const needsCheck = mode === 'immediate';
		const checked = immediateConfirmed;
		return !busy && (!needsCheck || checked);
	});

	// Fresh choices every time the dialog opens; leave content intact during the
	// close animation (reset-on-open, not on close). These are user-editable
	// choices, so they cannot be `$derived`; and the parent owns `open`, so it
	// can flip it without ever calling `handleOpenChange` — an effect on `open`
	// is the only place that catches every opening.
	$effect(() => {
		if (!open) return;
		mode = 'period_end';
		immediateConfirmed = false;
		errorMessage = null;
	});

	function handleOpenChange(next: boolean): void {
		// The cancellation is in flight; closing now would hide its outcome.
		if (!next && isBusy) return;
		onOpenChange(next);
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isBusy ? 'ignore' : 'close'}
		interactOutsideBehavior={isBusy ? 'ignore' : 'close'}
		showCloseButton={!isBusy}
	>
		<DialogHeader>
			<DialogTitle>{m['cancelSub.title']()}</DialogTitle>
			<DialogDescription>
				{m['cancelSub.description']({ plan: sub.plan.name, org: sub.organization_name })}
			</DialogDescription>
		</DialogHeader>

		<fieldset class="space-y-3" disabled={isBusy}>
			<legend class="sr-only">{m['cancelSub.title']()}</legend>

			<label class="flex items-start gap-3 rounded-lg border p-3">
				<input type="radio" name="{uid}-mode" value="period_end" bind:group={mode} class="mt-1" />
				<span>
					<span class="block text-sm font-medium">{m['cancelSub.periodEnd']()}</span>
					<span class="block text-xs text-muted-foreground">
						{#if sub.current_period_end}
							{m['cancelSub.periodEndHintDated']({ date: formatDate(sub.current_period_end) })}
						{:else}
							{m['cancelSub.periodEndHint']()}
						{/if}
					</span>
				</span>
			</label>

			<label class="flex items-start gap-3 rounded-lg border p-3">
				<input type="radio" name="{uid}-mode" value="immediate" bind:group={mode} class="mt-1" />
				<span>
					<span class="block text-sm font-medium">{m['cancelSub.immediate']()}</span>
					<span class="block text-xs text-muted-foreground">{m['cancelSub.immediateHint']()}</span>
				</span>
			</label>

			{#if mode === 'immediate'}
				<div class="flex items-center gap-2 pl-1">
					<Checkbox
						id="{uid}-immediate-confirm"
						checked={immediateConfirmed}
						onCheckedChange={(checked) => {
							immediateConfirmed = checked === true;
						}}
					/>
					<Label for="{uid}-immediate-confirm" class="cursor-pointer text-sm">
						{m['cancelSub.immediateConfirm']()}
					</Label>
				</div>
			{/if}
		</fieldset>

		{#if refundPolicy}
			<details class="rounded-lg border p-3">
				<summary
					class="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['cancelSub.refundPolicy']()}
				</summary>
				<MarkdownContent content={refundPolicy} class="mt-2 text-sm" />
			</details>
		{/if}

		{#if errorMessage}
			<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
		{/if}

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isBusy}>
				{m['cancelSub.keepCta']()}
			</Button>
			<Button variant="destructive" onclick={() => cancelMutation.mutate()} disabled={!canConfirm}>
				{#if isBusy}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['cancelSub.cancelling']()}
				{:else}
					{m['cancelSub.confirmCta']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
