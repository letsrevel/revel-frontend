<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { mesubscriptionsSubscribe } from '$lib/api/generated/sdk.gen';
	import type { PublicPlanSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { backendMessage } from '$lib/utils/api-error-detail';
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
	import { formatPlanPrice, isSubscriptionActivationPending } from '$lib/utils/subscriptions';
	import { formatMoney } from '$lib/utils/format';
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
		/**
		 * `Organization.membership_grace_period_days` — how long a failed renewal
		 * keeps access before the membership expires. `0` means no grace at all
		 * (the sweep expires the row on the first pass after the period ends).
		 * Optional because the field carries a server-side default, so the
		 * generated schema types it as optional.
		 */
		gracePeriodDays?: number | null;
		/**
		 * `Organization.membership_subscription_revival_window_days` — how long an
		 * EXPIRED subscription can be restarted in place. `0` means the org
		 * disabled revival entirely, not "zero days to act".
		 */
		revivalWindowDays?: number | null;
	}

	const {
		open,
		onOpenChange,
		plan,
		tierName,
		organizationId,
		organizationName,
		refundPolicy = null,
		gracePeriodDays = null,
		revivalWindowDays = null
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let errorMessage = $state<string | null>(null);
	// Set on success and never cleared: the browser is on its way to Stripe, so
	// the CTA must stay in its loading state until the page is replaced.
	let redirecting = $state(false);

	// The member already paid on an earlier attempt and the activation webhooks
	// are still in flight (409). Not a failure: the dialog swaps its whole body
	// for the "confirming your subscription" wait.
	//
	// Deliberately handled here rather than by closing and deferring to the org
	// page: `CheckoutReturnCard` only mounts when the page was loaded with a
	// Stripe return parameter, so a member who double-submits — or who comes back
	// and subscribes again — would be dropped onto an unchanged page with no
	// explanation of where their money went.
	let activationPending = $state(false);
	/** The backend's translated explanation for that 409, when it sent one. */
	let activationDetail = $state<string | null>(null);

	const priceLine = $derived(m['subscribe.priceLine']({ price: formatPlanPrice(plan) }));

	// The bare amount, not the rate: this line is about the charge that happens
	// on confirm, so "€10.00" — never "€10.00 / month".
	const firstChargeAmount = $derived(formatMoney(plan.price, plan.currency));

	const cadence = $derived.by(() => {
		const n = plan.period_count ?? 1;
		if (plan.period_unit === 'year') {
			return n > 1 ? m['subscribe.cadence.years']({ n }) : m['subscribe.cadence.year']();
		}
		return n > 1 ? m['subscribe.cadence.months']({ n }) : m['subscribe.cadence.month']();
	});

	/**
	 * A usable day count, or `null` when the org payload didn't carry the field
	 * (older/slimmer serializations) — never render "undefined days".
	 */
	function dayCount(value: number | null | undefined): number | null {
		return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
	}

	// Grace: `0` is not "a grace period of 0 days" — it means the membership
	// expires on the first sweep after the period ends, so it gets its own copy.
	const gracePeriodLine = $derived.by(() => {
		const days = dayCount(gracePeriodDays);
		if (days === null) return m['subscribe.billing.failedPayment.unknown']();
		if (days === 0) return m['subscribe.billing.failedPayment.none']();
		return days === 1
			? m['subscribe.billing.failedPayment.one']({ days })
			: m['subscribe.billing.failedPayment.other']({ days });
	});

	// Revival: `0` disables revival outright (the backend refuses with "Revival is
	// disabled for this organization"), so promising a window would be a lie.
	const revivalLine = $derived.by(() => {
		const days = dayCount(revivalWindowDays);
		if (days === null) return m['subscribe.billing.expiry.unknown']();
		if (days === 0) return m['subscribe.billing.expiry.none']();
		return days === 1
			? m['subscribe.billing.expiry.one']({ days })
			: m['subscribe.billing.expiry.other']({ days });
	});

	const subscribeMutation = createMutation(() => ({
		mutationFn: async () => {
			errorMessage = null;
			const res = await mesubscriptionsSubscribe({
				path: { org_id: organizationId },
				body: { plan_id: plan.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// Paid already, webhook still in flight. Keyed on the backend's
			// machine-readable `code` — the sibling `detail` is translated, so
			// matching on it would work only in English.
			if (isSubscriptionActivationPending(res.error)) {
				errorMessage = null;
				activationDetail = backendMessage(res.error);
				activationPending = true;
				return null;
			}
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back. The generated type promises
			// `message`, but django-ninja renders `HttpError` as `{ detail }`, so the
			// refusal has to be probed for both shapes: reading `.message` alone
			// would swallow every real reason (plan archived, sold out, org not
			// Stripe-connected, payment processing failed) behind generic copy.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscribe.error']());
			}
			// `checkout_url` became nullable when the backend added FREE plans, which
			// activate on the spot with no Stripe session. This dialog only knows how
			// to hand off to Checkout, and nothing in this UI can create a free plan
			// yet, so the case is unreachable today — surface it rather than
			// silently doing nothing if that ever stops being true.
			if (!res.data.checkout_url) {
				throw new Error(m['subscribe.error']());
			}
			return { ...res.data, checkout_url: res.data.checkout_url };
		},
		onSuccess: (data) => {
			// `null` is the activation-pending answer: no Checkout session to go to.
			if (!data) return;
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
		showCloseButton={!isBusy}
	>
		<DialogHeader>
			<DialogTitle>{m['subscribe.title']({ plan: plan.name })}</DialogTitle>
			<DialogDescription>{tierName}</DialogDescription>
		</DialogHeader>

		{#if activationPending}
			<div class="space-y-2" role="status" aria-live="polite">
				<p class="flex items-center gap-2 text-sm">
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['subscribe.return.confirming']()}
				</p>
				{#if activationDetail}
					<p class="text-sm text-muted-foreground">{activationDetail}</p>
				{/if}
			</div>
		{:else}
			<div class="space-y-4">
				<div class="rounded-lg border bg-muted/40 p-3">
					<p class="text-sm text-muted-foreground">{organizationName}</p>
					<p class="text-lg font-semibold">{priceLine}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{m['subscribe.firstCharge']({ price: firstChargeAmount })}
					</p>
				</div>

				<p class="text-sm text-muted-foreground">{m['subscribe.autoRenew']({ cadence })}</p>

				<!-- The one canonical billing disclosure. Collapsed by default, and
				     deliberately not repeated on any other membership surface. -->
				<details class="rounded-lg border p-3">
					<summary
						class="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{m['subscribe.billing.title']()}
					</summary>
					<ul class="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
						<li>{m['subscribe.billing.renewal']()}</li>
						<li>{gracePeriodLine}</li>
						<li>{m['subscribe.billing.cancelling']()}</li>
						<li>{revivalLine}</li>
					</ul>
				</details>

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
		{/if}

		<DialogFooter class="gap-2">
			{#if activationPending}
				<!-- No retry: a second attempt can only hit the same 409 until the
				     webhook lands. Dismissing is the only useful action left. -->
				<Button variant="outline" onclick={() => handleOpenChange(false)}>
					{m['common.close']()}
				</Button>
			{:else}
				<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isBusy}>
					{m['subscribe.cancel']()}
				</Button>
				<Button onclick={() => subscribeMutation.mutate()} disabled={isBusy}>
					{#if isBusy}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['subscribe.confirmCta']()}
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
