<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import { mesubscriptionsListMySubscriptionPayments } from '$lib/api/generated/sdk.gen';
	import type { MyMembershipPaymentSchema, PaymentStatus } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { MY_MEMBERSHIPS_KEY } from '$lib/utils/subscription-cache';
	import { formatDate } from '$lib/utils/date';
	import { formatMoney } from '$lib/utils/format';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import { ChevronDown, Loader2 } from '@lucide/svelte';

	interface Props {
		/**
		 * Keyed on the ORGANIZATION, never on a subscription id: the endpoint returns
		 * every payment the caller ever made in this org, across subscriptions that
		 * have since been cancelled, expired or revived. That is also why the
		 * disclosure renders on a membership with no live subscription at all — the
		 * receipts outlive it.
		 */
		organizationId: string;
	}

	const { organizationId }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const panelId = $props.id();

	let open = $state(false);
	let page = $state(1);

	/** The server's own page size (`@paginate(PageNumberPaginationExtra, page_size=20)`). */
	const PAGE_SIZE = 20;

	/**
	 * Lazy on purpose: one card renders per membership on the account hub, so an
	 * eager query here would be an N+1 across the whole list. `enabled` waits for
	 * the member to actually open the history.
	 */
	const historyQuery = createQuery(() => ({
		// Nested UNDER the memberships key on purpose: every mutation that already
		// invalidates that prefix refreshes the receipts too. Spread from the
		// exported constant so the prefix relationship cannot drift.
		queryKey: [...MY_MEMBERSHIPS_KEY, organizationId, 'payments', page],
		queryFn: async () => {
			const res = await mesubscriptionsListMySubscriptionPayments({
				path: { org_id: organizationId },
				query: { page, page_size: PAGE_SIZE },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure even
			// when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['subscriptions.payments.error']());
			}
			return res.data;
		},
		enabled: open && !!accessToken,
		// Paging keeps the previous page on screen instead of collapsing the panel
		// back to a spinner (and back to the top of the card) on every click.
		placeholderData: keepPreviousData
	}));

	const payments = $derived(historyQuery.data?.results ?? []);
	const total = $derived(historyQuery.data?.count ?? 0);
	const pageCount = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

	// Both operands read unconditionally: a short-circuiting `||` inside a $derived
	// leaves the skipped TanStack property untracked, freezing the value.
	const isPaging = $derived.by(() => {
		const fetching = historyQuery.isFetching;
		const pending = historyQuery.isPending;
		return fetching && !pending;
	});

	/**
	 * A *partial* refund deliberately leaves `status = 'succeeded'` — the member
	 * keeps the period they partly paid for — so the status column alone cannot
	 * reveal it. A full refund flips the status to `refunded` and needs no
	 * annotation. Amounts arrive as decimal strings, so compare numerically.
	 */
	function partialRefund(p: MyMembershipPaymentSchema): string | null {
		if (!p.refund_amount) return null;
		const refunded = Number(p.refund_amount);
		if (!Number.isFinite(refunded) || refunded <= 0) return null;
		if (refunded >= Number(p.amount)) return null;
		const amount = formatMoney(p.refund_amount, p.currency);
		return p.refunded_at
			? m['subscriptions.payments.partiallyRefundedOn']({
					amount,
					date: formatDate(p.refunded_at)
				})
			: m['subscriptions.payments.partiallyRefunded']({ amount });
	}

	function statusLabel(status: PaymentStatus): string {
		switch (status) {
			case 'succeeded':
				return m['subscriptions.payments.status.succeeded']();
			case 'pending':
				return m['subscriptions.payments.status.pending']();
			case 'failed':
				return m['subscriptions.payments.status.failed']();
			case 'refunded':
				return m['subscriptions.payments.status.refunded']();
			// A status the client doesn't know yet (backend enum grew) renders its raw
			// value rather than an empty cell.
			default:
				return status;
		}
	}

	/** Thin mapper: raw payment status -> StatusBadge tone. Each of the four
	 * backend statuses gets its own tone. */
	function statusTone(status: PaymentStatus): Tone {
		switch (status) {
			case 'succeeded':
				return 'success';
			case 'pending':
				return 'warning';
			case 'failed':
				return 'danger';
			case 'refunded':
				return 'neutral';
			default:
				return 'neutral';
		}
	}

	function goTo(next: number) {
		page = Math.min(Math.max(1, next), pageCount);
	}
</script>

<div class="mt-4 border-t pt-3">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		aria-expanded={open}
		aria-controls={panelId}
		onclick={() => (open = !open)}
	>
		{m['subscriptions.payments.title']()}
		<ChevronDown
			class="h-4 w-4 shrink-0 transition-transform {open ? 'rotate-180' : ''}"
			aria-hidden="true"
		/>
	</button>

	<!-- The panel element exists even while collapsed so `aria-controls` always
	     resolves; only its contents are conditional. -->
	<div id={panelId} hidden={!open} aria-busy={isPaging}>
		{#if open}
			{#if historyQuery.isPending}
				<p class="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['subscriptions.payments.loading']()}
				</p>
			{:else if historyQuery.isError}
				<div class="py-3" role="alert">
					<p class="text-sm text-destructive">
						{historyQuery.error?.message || m['subscriptions.payments.error']()}
					</p>
					<Button variant="outline" size="sm" class="mt-2" onclick={() => historyQuery.refetch()}>
						{m['subscriptions.payments.retry']()}
					</Button>
				</div>
			{:else if payments.length === 0}
				<p class="py-3 text-sm text-muted-foreground" role="status">
					{m['subscriptions.payments.empty']()}
				</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="mt-1 w-full text-sm">
						<caption class="sr-only">{m['subscriptions.payments.title']()}</caption>
						<thead
							class="border-b text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>
							<tr>
								<th scope="col" class="py-2 pr-3">
									{m['subscriptions.payments.colDate']()}
								</th>
								<th scope="col" class="py-2 pr-3">
									{m['subscriptions.payments.colAmount']()}
								</th>
								<th scope="col" class="py-2">
									{m['subscriptions.payments.colStatus']()}
								</th>
							</tr>
						</thead>
						<tbody>
							{#each payments as p, i (p.id ?? `${p.created_at}-${i}`)}
								{@const refunded = partialRefund(p)}
								<tr class="border-b align-top last:border-0">
									<td class="py-2 pr-3">
										{formatDate(p.created_at)}
										<span class="block text-xs text-muted-foreground">
											{m['subscriptions.payments.period']({
												start: formatDate(p.period_start),
												end: formatDate(p.period_end)
											})}
										</span>
									</td>
									<td class="py-2 pr-3">
										{formatMoney(p.amount, p.currency)}
										{#if refunded}
											<span class="block text-xs text-muted-foreground">{refunded}</span>
										{/if}
									</td>
									<td class="py-2">
										<!-- Plain `status-badge` testid. This table renders INSIDE the account
										     hub's membership <article>, next to the subscription-status pill, and
										     a pending PAYMENT row would answer the same lookup as a pending
										     SUBSCRIPTION and trip Playwright strict mode (j23 revival.spec.ts).
										     That is why the pill above carries its own
										     `membership-subscription-status` testid — the two are addressable
										     apart, and this cell needs no opt-out of its own (#795, replacing the
										     `aria-label={undefined}` hatch #788 needed). -->
										<StatusBadge
											tone={statusTone(p.status)}
											label={statusLabel(p.status)}
											size="sm"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Only 20 rows come back per request, so a member with a long history
				     would otherwise be silently truncated at their most recent year. -->
				{#if pageCount > 1}
					<nav
						class="mt-2 flex items-center justify-between gap-2"
						aria-label={m['subscriptions.payments.pagination']()}
					>
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1 || isPaging}
							onclick={() => goTo(page - 1)}
						>
							{m['subscriptions.payments.previous']()}
						</Button>
						<span class="text-xs text-muted-foreground" role="status">
							{m['subscriptions.payments.pageOf']({ page, pages: pageCount })}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= pageCount || isPaging}
							onclick={() => goTo(page + 1)}
						>
							{m['subscriptions.payments.next']()}
						</Button>
					</nav>
				{/if}
			{/if}
		{/if}
	</div>
</div>
