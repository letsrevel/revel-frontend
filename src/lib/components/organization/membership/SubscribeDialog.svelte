<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { mesubscriptionsSubscribe } from '$lib/api/generated/sdk.gen';
	import type { PublicPlanSchema } from '$lib/api/generated/types.gen';
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
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		/** Narrowed by the caller: only plans with a server-side id are subscribable. */
		plan: PublicPlanSchema & { id: string };
		tierName: string;
		organizationId: string;
		organizationName: string;
		/** Org-level refund policy markdown, shown collapsed when present. */
		refundPolicy?: string | null;
	}

	const {
		open,
		onOpenChange,
		plan,
		tierName,
		organizationId,
		organizationName,
		refundPolicy = null
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let errorMessage = $state<string | null>(null);
	// Set on success and never cleared: the browser is on its way to Stripe, so
	// the CTA must stay in its loading state until the page is replaced.
	let redirecting = $state(false);

	const priceLine = $derived(m['subscribe.priceLine']({ price: formatPlanPrice(plan) }));

	const cadence = $derived.by(() => {
		const n = plan.period_count ?? 1;
		if (plan.period_unit === 'year') {
			return n > 1 ? m['subscribe.cadence.years']({ n }) : m['subscribe.cadence.year']();
		}
		return n > 1 ? m['subscribe.cadence.months']({ n }) : m['subscribe.cadence.month']();
	});

	const subscribeMutation = createMutation(() => ({
		mutationFn: async () => {
			errorMessage = null;
			const res = await mesubscriptionsSubscribe({
				path: { org_id: organizationId },
				body: { plan_id: plan.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(res.error?.message ?? m['subscribe.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			redirecting = true;
			// Hosted Stripe Checkout lives on another origin, so this is a real
			// document navigation, not a SvelteKit one.
			window.location.href = data.checkout_url;
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['subscribe.error']();
		}
	}));

	// Both operands are read unconditionally: a short-circuiting `||` would skip
	// `redirecting` whenever the mutation is still pending, leaving it untracked.
	const isBusy = $derived.by(() => {
		const pending = subscribeMutation.isPending;
		const goingToStripe = redirecting;
		return pending || goingToStripe;
	});

	function handleOpenChange(next: boolean): void {
		// A checkout session is being created; closing now would strand the user
		// mid-redirect.
		if (!next && isBusy) return;
		onOpenChange(next);
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isBusy ? 'ignore' : 'close'}
		interactOutsideBehavior={isBusy ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle>{m['subscribe.title']({ plan: plan.name })}</DialogTitle>
			<DialogDescription>{tierName}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<div class="rounded-lg border bg-muted/40 p-3">
				<p class="text-sm text-muted-foreground">{organizationName}</p>
				<p class="text-lg font-semibold">{priceLine}</p>
			</div>

			<p class="text-sm text-muted-foreground">{m['subscribe.autoRenew']({ cadence })}</p>

			{#if refundPolicy}
				<details class="rounded-lg border p-3">
					<summary
						class="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{m['subscribe.refundPolicy']()}
					</summary>
					<MarkdownContent content={refundPolicy} class="mt-2 text-sm" />
				</details>
			{/if}

			<p class="text-xs text-muted-foreground">{m['subscribe.stripeDisclaimer']()}</p>

			{#if errorMessage}
				<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isBusy}>
				{m['subscribe.cancel']()}
			</Button>
			<Button onclick={() => subscribeMutation.mutate()} disabled={isBusy}>
				{#if isBusy}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['subscribe.confirmCta']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
