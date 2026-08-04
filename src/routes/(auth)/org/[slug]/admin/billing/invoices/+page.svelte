<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatMoney } from '$lib/utils/format';
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertCircle,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Download,
		FileText,
		Loader2,
		X
	} from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { getBackendUrl } from '$lib/config/api';
	import {
		organizationadminvatListInvoices,
		organizationadminvatGetInvoice,
		organizationadminvatDownloadInvoice
	} from '$lib/api/generated/sdk.gen';
	import type { PlatformFeeInvoiceSchema } from '$lib/api/generated';
	import type { LayoutData } from '../../$types';
	import { formatMonthYearLabel } from '$lib/utils/date';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		data: LayoutData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);

	// Pagination
	let currentPage = $state(1);
	const pageSize = 20;

	// Detail view
	let selectedInvoiceId = $state<string | null>(null);

	// ─── Invoice List Query ─────────────────────────────────────────
	const invoicesQuery = browser
		? createQuery(() => ({
				queryKey: ['invoices', slug, currentPage],
				queryFn: async () => {
					const response = await organizationadminvatListInvoices({
						path: { slug },
						query: { page: currentPage, page_size: pageSize },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error || !response.data) throw new Error('Failed to load invoices');
					return response.data;
				},
				enabled: !!accessToken
			}))
		: null;

	const totalPages = $derived(
		invoicesQuery?.data ? Math.ceil(invoicesQuery.data.count / pageSize) : 0
	);

	// ─── Invoice Detail Query ───────────────────────────────────────
	const invoiceDetailQuery = browser
		? createQuery(() => ({
				queryKey: ['invoice-detail', slug, selectedInvoiceId],
				queryFn: async () => {
					if (!selectedInvoiceId) throw new Error('No invoice selected');
					const response = await organizationadminvatGetInvoice({
						path: { slug, invoice_id: selectedInvoiceId },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error || !response.data) throw new Error('Failed to load invoice');
					return response.data;
				},
				enabled: !!accessToken && !!selectedInvoiceId
			}))
		: null;

	// ─── Download PDF Mutation ──────────────────────────────────────
	const downloadMutation = browser
		? createMutation(() => ({
				mutationFn: async (invoiceId: string) => {
					const response = await organizationadminvatDownloadInvoice({
						path: { slug, invoice_id: invoiceId },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.response?.status === 404) {
						throw new Error(m['orgAdmin.billing.invoices.detail.pdfNotReady']());
					}
					if (response.error || !response.data) {
						throw new Error(m['orgAdmin.billing.invoices.detail.downloadError']());
					}
					return response.data;
				},
				onSuccess: (data) => {
					window.open(getBackendUrl(data.download_url), '_blank');
				},
				onError: (error: Error) => {
					toast.error(error.message);
				}
			}))
		: null;

	// ─── Helpers ────────────────────────────────────────────────────
	function formatPeriod(start: string, _end: string): string {
		return formatMonthYearLabel(start);
	}

	function formatCurrency(amount: string, currency: string): string {
		return formatMoney(amount, currency);
	}

	/** Thin mapper: raw invoice status -> StatusBadge tone. `draft` and any
	 * future/unknown status fall back to neutral rather than guessing. */
	function statusTone(status: string): Tone {
		switch (status) {
			case 'paid':
				return 'success';
			case 'issued':
				return 'info';
			case 'cancelled':
				return 'danger';
			default:
				return 'neutral';
		}
	}

	function statusLabel(status: string): string {
		const labels: Record<string, () => string> = {
			draft: () => m['orgAdmin.billing.invoices.status.draft'](),
			issued: () => m['orgAdmin.billing.invoices.status.issued'](),
			paid: () => m['orgAdmin.billing.invoices.status.paid'](),
			cancelled: () => m['orgAdmin.billing.invoices.status.cancelled']()
		};
		return labels[status]?.() ?? status;
	}

	function openDetail(invoice: PlatformFeeInvoiceSchema) {
		selectedInvoiceId = invoice.id;
	}

	function closeDetail() {
		selectedInvoiceId = null;
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.invoices.title']()} - {data.organization.name}</title>
</svelte:head>

<div class="space-y-6 px-4">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing', { slug: slug })}
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			aria-label={m['common.backToBilling']()}
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<!-- No kicker: the back-to-billing link above already says it. -->
		<PageHeader
			title={m['orgAdmin.billing.invoices.title']()}
			subtitle={m['orgAdmin.billing.invoices.description']()}
			class="flex-1"
		/>
	</div>

	{#if invoicesQuery?.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2
				class="h-6 w-6 animate-spin text-muted-foreground"
				aria-label={m['common.loading']()}
			/>
		</div>
	{:else if invoicesQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm">{extractErrorMessage(invoicesQuery.error)}</p>
		</div>
	{:else if !invoicesQuery?.data?.results?.length}
		<EmptyState
			icon={FileText}
			title={m['orgAdmin.billing.invoices.empty']()}
			body={m['orgAdmin.billing.invoices.emptyDescription']()}
		/>
	{:else}
		<!-- Invoice Table -->
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
						<th class="px-4 py-3 text-left">
							{m['orgAdmin.billing.invoices.columns.invoiceNumber']()}
						</th>
						<th class="px-4 py-3 text-left">
							{m['orgAdmin.billing.invoices.columns.period']()}
						</th>
						<th class="px-4 py-3 text-left">
							{m['orgAdmin.billing.invoices.columns.status']()}
						</th>
						<th class="px-4 py-3 text-right">
							{m['orgAdmin.billing.invoices.columns.grossAmount']()}
						</th>
						<th class="px-4 py-3 text-center">
							<span class="sr-only">{m['common.actions']()}</span>
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each invoicesQuery.data.results as invoice (invoice.id)}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-4 py-3 font-medium">
								<button
									type="button"
									class="rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onclick={() => openDetail(invoice)}
								>
									{invoice.invoice_number}
								</button>
							</td>
							<td class="px-4 py-3 text-muted-foreground">
								{formatPeriod(invoice.period_start, invoice.period_end)}
							</td>
							<td class="px-4 py-3">
								<StatusBadge
									tone={statusTone(invoice.status)}
									label={statusLabel(invoice.status)}
									aria-label={statusLabel(invoice.status)}
								/>
							</td>
							<td class="px-4 py-3 text-right font-mono">
								{formatCurrency(invoice.fee_gross, invoice.currency)}
							</td>
							<td class="px-4 py-3 text-center">
								<Button
									variant="ghost"
									size="sm"
									onclick={(e) => {
										e.stopPropagation();
										downloadMutation?.mutate(invoice.id);
									}}
									disabled={downloadMutation?.isPending}
									aria-label={m['common.downloadPdf']()}
								>
									<Download class="h-4 w-4" />
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{invoicesQuery.data.count} invoice{invoicesQuery.data.count === 1 ? '' : 's'}
				</p>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage <= 1}
						aria-label={m['common.paginationPrevious']()}
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
					>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					<span class="text-sm">
						{currentPage} / {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage >= totalPages}
						aria-label={m['common.paginationNext']()}
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
					>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- ────────────────────────────────────────────────────────────────
     Invoice Detail Drawer
     ──────────────────────────────────────────────────────────────── -->
{#if selectedInvoiceId}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/40"
		onclick={closeDetail}
		aria-label={m['common.close']()}
	></button>

	<!-- Drawer -->
	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-background shadow-xl sm:max-w-xl"
		role="dialog"
		aria-label={m['orgAdmin.billing.invoices.detail.title']()}
		tabindex="-1"
	>
		<div class="flex items-center justify-between border-b px-6 py-4">
			<h2 class="text-lg font-semibold">
				{m['orgAdmin.billing.invoices.detail.title']()}
			</h2>
			<Button variant="ghost" size="sm" onclick={closeDetail} aria-label={m['common.close']()}>
				<X class="h-5 w-5" />
			</Button>
		</div>

		<div class="flex-1 space-y-6 p-6">
			{#if invoiceDetailQuery?.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2
						class="h-6 w-6 animate-spin text-muted-foreground"
						aria-label={m['common.loading']()}
					/>
				</div>
			{:else if invoiceDetailQuery?.error}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
					role="alert"
				>
					<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
					<p class="text-sm">{extractErrorMessage(invoiceDetailQuery.error)}</p>
				</div>
			{:else if invoiceDetailQuery?.data}
				{@const inv = invoiceDetailQuery.data}

				<!-- Invoice Number & Status -->
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-muted-foreground">
							{m['orgAdmin.billing.invoices.columns.invoiceNumber']()}
						</p>
						<p class="text-lg font-semibold">{inv.invoice_number}</p>
					</div>
					<StatusBadge
						tone={statusTone(inv.status)}
						label={statusLabel(inv.status)}
						aria-label={statusLabel(inv.status)}
					/>
				</div>

				<!-- Period -->
				<div>
					<p class="text-sm text-muted-foreground">
						{m['orgAdmin.billing.invoices.columns.period']()}
					</p>
					<p class="font-medium">{formatPeriod(inv.period_start, inv.period_end)}</p>
				</div>

				<!-- Fee Breakdown -->
				<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
					<h3 class="font-medium">{m['orgAdmin.billing.invoices.detail.breakdown']()}</h3>
					<dl class="space-y-1.5 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">
								{m['orgAdmin.billing.invoices.detail.net']()}
							</dt>
							<dd class="font-mono">{formatCurrency(inv.fee_net, inv.currency)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">
								{m['orgAdmin.billing.invoices.detail.vat']()} ({inv.fee_vat_rate}%)
							</dt>
							<dd class="font-mono">{formatCurrency(inv.fee_vat, inv.currency)}</dd>
						</div>
						<div class="flex justify-between border-t pt-1.5 font-medium">
							<dt>{m['orgAdmin.billing.invoices.detail.gross']()}</dt>
							<dd class="font-mono">{formatCurrency(inv.fee_gross, inv.currency)}</dd>
						</div>
					</dl>
				</div>

				<!-- Reverse Charge -->
				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">
						{m['orgAdmin.billing.invoices.detail.reverseCharge']()}
					</span>
					<span class="font-medium">
						{#if inv.reverse_charge}
							{m['orgAdmin.billing.invoices.detail.reverseChargeYes']()}
						{:else}
							{m['orgAdmin.billing.invoices.detail.reverseChargeNo']()}
						{/if}
					</span>
				</div>

				<!-- Organization Snapshot -->
				<div class="space-y-1.5 text-sm">
					<h3 class="font-medium">{m['orgAdmin.billing.invoices.detail.orgInfo']()}</h3>
					<p>{inv.org_name}</p>
					{#if inv.org_vat_id}
						<p class="text-muted-foreground">VAT: {inv.org_vat_id}</p>
					{/if}
					{#if inv.org_vat_country}
						<p class="text-muted-foreground">
							{m['orgAdmin.billing.billingInfo.country']()}: {inv.org_vat_country}
						</p>
					{/if}
				</div>

				<!-- Period Statistics -->
				<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
					<h3 class="font-medium">{m['orgAdmin.billing.invoices.detail.stats']()}</h3>
					<dl class="space-y-1.5 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">
								{m['orgAdmin.billing.invoices.detail.totalTickets']()}
							</dt>
							<dd class="font-medium">{inv.total_tickets}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">
								{m['orgAdmin.billing.invoices.detail.totalRevenue']()}
							</dt>
							<dd class="font-mono font-medium">
								{formatCurrency(inv.total_ticket_revenue, inv.currency)}
							</dd>
						</div>
					</dl>
				</div>

				<!-- Download PDF -->
				<Button
					class="w-full"
					onclick={() => downloadMutation?.mutate(inv.id)}
					disabled={downloadMutation?.isPending}
				>
					{#if downloadMutation?.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{:else}
						<Download class="mr-2 h-4 w-4" aria-hidden="true" />
					{/if}
					{m['orgAdmin.billing.invoices.detail.downloadPdf']()}
				</Button>
			{/if}
		</div>
	</div>
{/if}
