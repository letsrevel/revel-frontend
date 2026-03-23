<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { FileText, Download, Eye, Loader2, ArrowLeft } from 'lucide-svelte';
	import {
		referralpayoutListPayouts,
		referralpayoutGetStatement,
		referralpayoutDownloadStatement
	} from '$lib/api/generated/sdk.gen';
	import type {
		ReferralPayoutSchema,
		ReferralPayoutStatementSchema
	} from '$lib/api/generated/types.gen';

	const user = $derived(authStore.user);
	const accessToken = $derived(authStore.accessToken);

	// Redirect non-referrers
	$effect(() => {
		if (user && !user.referral_code) {
			goto('/dashboard');
		}
	});

	let currentPage = $state(1);

	const payoutsQuery = createQuery(() => ({
		queryKey: ['referral-payouts', currentPage],
		queryFn: async () => {
			const response = await referralpayoutListPayouts({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: { page: currentPage, page_size: 20 }
			});
			if (response.error || !response.data) throw new Error('Failed to fetch payouts');
			return response.data;
		},
		enabled: !!accessToken && !!user?.referral_code,
		staleTime: 60_000
	}));

	const payouts = $derived(payoutsQuery.data?.results ?? []);
	const totalCount = $derived(payoutsQuery.data?.count ?? 0);
	const hasNext = $derived(!!payoutsQuery.data?.next);
	const hasPrevious = $derived(!!payoutsQuery.data?.previous);

	// Statement modal
	let selectedPayout = $state<ReferralPayoutSchema | null>(null);
	let statement = $state<ReferralPayoutStatementSchema | null>(null);
	let isLoadingStatement = $state(false);
	let isDownloading = $state(false);

	async function viewStatement(payout: ReferralPayoutSchema) {
		selectedPayout = payout;
		dialogOpen = true;
		isLoadingStatement = true;
		statement = null;

		try {
			const response = await referralpayoutGetStatement({
				headers: { Authorization: `Bearer ${accessToken}` },
				path: { payout_id: payout.id }
			});
			if (response.error) throw new Error('Failed to fetch statement');
			statement = response.data as ReferralPayoutStatementSchema;
		} catch {
			statement = null;
		} finally {
			isLoadingStatement = false;
		}
	}

	async function downloadPdf(payoutId: string) {
		isDownloading = true;
		try {
			const response = await referralpayoutDownloadStatement({
				headers: { Authorization: `Bearer ${accessToken}` },
				path: { payout_id: payoutId }
			});
			if (response.error) throw new Error('Failed to get download URL');
			if (response.data?.download_url) {
				window.open(response.data.download_url, '_blank');
			}
		} finally {
			isDownloading = false;
		}
	}

	let dialogOpen = $state(false);

	function closeModal() {
		dialogOpen = false;
		selectedPayout = null;
		statement = null;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatPeriod(start: string, end: string): string {
		return `${formatDate(start)} – ${formatDate(end)}`;
	}

	function formatAmount(amount: string, currency: string): string {
		const num = parseFloat(amount);
		return `${currency.toUpperCase()} ${num.toFixed(2)}`;
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'paid':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
			case 'pending':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
			case 'calculated':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
			case 'failed':
				return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
			case 'rolled_over':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'paid':
				return m['referral.statusPaid']();
			case 'pending':
				return m['referral.statusPending']();
			case 'calculated':
				return m['referral.statusCalculated']();
			case 'failed':
				return m['referral.statusFailed']();
			case 'rolled_over':
				return m['referral.statusRolledOver']();
			default:
				return status;
		}
	}
</script>

<svelte:head>
	<title>{m['referral.payoutsTitle']()} - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<div class="mb-6 flex items-center gap-4">
		<a
			href="/account/referral"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" aria-hidden="true" />
			{m['referral.settings']()}
		</a>
	</div>

	<h1 class="text-2xl font-bold">{m['referral.payoutsTitle']()}</h1>
	<p class="mt-1 text-sm text-muted-foreground">{m['referral.payoutsDescription']()}</p>

	{#if payoutsQuery.isLoading}
		<div class="mt-8 flex justify-center">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if payoutsQuery.isError}
		<div
			class="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
			role="alert"
		>
			{m['referral.error']()}
		</div>
	{:else if payouts.length === 0}
		<div class="mt-8 rounded-lg border bg-card p-8 text-center">
			<FileText class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h2 class="mt-4 text-lg font-semibold">{m['referral.noPayouts']()}</h2>
			<p class="mt-1 text-sm text-muted-foreground">{m['referral.noPayoutsDescription']()}</p>
		</div>
	{:else}
		<!-- Payouts Table -->
		<div class="mt-6 overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="border-b bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">{m['referral.period']()}</th>
						<th class="px-4 py-3 text-right font-medium">{m['referral.amount']()}</th>
						<th class="px-4 py-3 text-center font-medium">{m['referral.status']()}</th>
						<th class="px-4 py-3 text-right font-medium">{m['referral.actions']()}</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each payouts as payout (payout.id)}
						<tr class="hover:bg-muted/30">
							<td class="px-4 py-3 text-sm">
								{formatPeriod(payout.period_start, payout.period_end)}
							</td>
							<td class="px-4 py-3 text-right font-mono text-sm">
								{formatAmount(payout.payout_amount, payout.currency)}
								{#if parseFloat(payout.rolled_over_amount) > 0}
									<p
										class="mt-0.5 text-xs text-blue-600 dark:text-blue-400"
										title={m['referral.rolledOverTooltip']()}
									>
										{m['referral.rolledOverAmount']()}: {formatAmount(
											payout.rolled_over_amount,
											payout.currency
										)}
									</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-center">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColor(
										payout.status
									)}"
								>
									{statusLabel(payout.status)}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-1">
									{#if payout.has_statement}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => viewStatement(payout)}
											class="gap-1"
											aria-label={m['referral.viewStatement']()}
										>
											<Eye class="h-4 w-4" aria-hidden="true" />
											<span class="hidden sm:inline">{m['referral.viewStatement']()}</span>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => downloadPdf(payout.id)}
											disabled={isDownloading}
											aria-label={m['referral.downloadPdf']()}
											class="gap-1"
										>
											<Download class="h-4 w-4" aria-hidden="true" />
											<span class="hidden sm:inline">{m['referral.downloadPdf']()}</span>
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalCount > 20}
			<div class="mt-4 flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					disabled={!hasPrevious}
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
				>
					Previous
				</Button>
				<span class="text-sm text-muted-foreground">
					Page {currentPage}
				</span>
				<Button variant="outline" size="sm" disabled={!hasNext} onclick={() => (currentPage += 1)}>
					Next
				</Button>
			</div>
		{/if}
	{/if}
</div>

<!-- Statement Modal -->
<Dialog.Root bind:open={dialogOpen} onOpenChange={(open) => !open && closeModal()}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{m['referral.statementTitle']()}</Dialog.Title>
		</Dialog.Header>

		{#if isLoadingStatement}
			<div class="flex justify-center py-8">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if statement && selectedPayout}
			<dl class="space-y-3 text-sm">
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['referral.documentType']()}</dt>
					<dd class="font-medium">
						{statement.document_type === 'self_billing_invoice'
							? m['referral.documentTypeSelfBilling']()
							: m['referral.documentTypePayout']()}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['referral.documentNumber']()}</dt>
					<dd class="font-mono font-medium">{statement.document_number}</dd>
				</div>
				<div class="border-t pt-3"></div>
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['referral.period']()}</dt>
					<dd>{formatPeriod(selectedPayout.period_start, selectedPayout.period_end)}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['referral.netPlatformFees']()}</dt>
					<dd class="font-mono">
						{formatAmount(selectedPayout.net_platform_fees, selectedPayout.currency)}
					</dd>
				</div>
				<div class="border-t pt-3"></div>
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['referral.amountGross']()}</dt>
					<dd class="font-mono">{formatAmount(statement.amount_gross, statement.currency)}</dd>
				</div>
				{#if parseFloat(statement.amount_vat) > 0}
					<div class="flex justify-between">
						<dt class="text-muted-foreground">
							{m['referral.amountVat']()} ({statement.vat_rate}%)
						</dt>
						<dd class="font-mono">{formatAmount(statement.amount_vat, statement.currency)}</dd>
					</div>
				{/if}
				<div class="flex justify-between font-semibold">
					<dt>{m['referral.amountNet']()}</dt>
					<dd class="font-mono">{formatAmount(statement.amount_net, statement.currency)}</dd>
				</div>
				{#if statement.reverse_charge}
					<div class="flex justify-between">
						<dt class="text-muted-foreground">{m['referral.reverseCharge']()}</dt>
						<dd>{m['referral.yes']()}</dd>
					</div>
				{/if}
				{#if statement.issued_at}
					<div class="flex justify-between">
						<dt class="text-muted-foreground">{m['referral.issuedAt']()}</dt>
						<dd>{formatDate(statement.issued_at)}</dd>
					</div>
				{/if}
			</dl>
		{:else}
			<p class="py-8 text-center text-muted-foreground">{m['referral.error']()}</p>
		{/if}

		<Dialog.Footer>
			{#if selectedPayout?.has_statement}
				<Button
					variant="outline"
					onclick={() => selectedPayout && downloadPdf(selectedPayout.id)}
					disabled={isDownloading}
					class="gap-2"
				>
					<Download class="h-4 w-4" aria-hidden="true" />
					{m['referral.downloadPdf']()}
				</Button>
			{/if}
			<Button variant="outline" onclick={closeModal}>
				{m['referral.close']()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
