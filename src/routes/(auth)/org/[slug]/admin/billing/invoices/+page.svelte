<script lang="ts">
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
	} from 'lucide-svelte';
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

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

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
					if (response.error) throw new Error('Failed to load invoices');
					return response.data!;
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
					if (response.error) throw new Error('Failed to load invoice');
					return response.data!;
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
					if (response.response.status === 404) {
						throw new Error(m['orgAdmin.billing.invoices.detail.pdfNotReady']());
					}
					if (response.error) {
						throw new Error(m['orgAdmin.billing.invoices.detail.downloadError']());
					}
					return response.data!;
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
	function formatPeriod(start: string, end: string): string {
		const startDate = new Date(start);
		return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	function formatCurrency(amount: string, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
				parseFloat(amount)
			);
		} catch {
			return `${amount} ${currency}`;
		}
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'paid':
				return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
			case 'issued':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'draft':
				return 'bg-muted text-muted-foreground';
			case 'cancelled':
				return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
			default:
				return 'bg-muted text-muted-foreground';
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
			href="/org/{slug}/admin/billing"
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			aria-label={m['common.backToBilling']()}
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">
				{m['orgAdmin.billing.invoices.title']()}
			</h1>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.invoices.description']()}
			</p>
		</div>
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
		<!-- Empty State -->
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center"
		>
			<FileText class="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
			<h3 class="font-medium">{m['orgAdmin.billing.invoices.empty']()}</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.billing.invoices.emptyDescription']()}
			</p>
		</div>
	{:else}
		<!-- Invoice Table -->
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.invoices.columns.invoiceNumber']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.invoices.columns.period']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.invoices.columns.status']()}
						</th>
						<th class="px-4 py-3 text-right font-medium">
							{m['orgAdmin.billing.invoices.columns.grossAmount']()}
						</th>
						<th class="px-4 py-3 text-center font-medium">
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
								<span
									class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(
										invoice.status
									)}"
								>
									{statusLabel(invoice.status)}
								</span>
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
	<aside
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-background shadow-xl sm:max-w-xl"
		role="dialog"
		aria-label={m['orgAdmin.billing.invoices.detail.title']()}
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
					<span class="rounded-full px-3 py-1 text-xs font-medium {statusColor(inv.status)}">
						{statusLabel(inv.status)}
					</span>
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
	</aside>
{/if}
