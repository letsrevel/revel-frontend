<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { getBackendUrl } from '$lib/config/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		FileText,
		Download,
		Search,
		Eye,
		Loader2,
		ArrowLeft,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import {
		dashboardDashboardInvoices,
		dashboardDashboardInvoiceDownload
	} from '$lib/api/generated/sdk.gen';
	import type { AttendeeInvoiceSchema } from '$lib/api/generated/types.gen';

	const accessToken = $derived(authStore.accessToken);

	// ─── Search ─────────────────────────────────────────────────────
	let searchInput = $state('');
	let searchQuery = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value;
		searchInput = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchQuery = value;
			currentPage = 1;
		}, 300);
	}

	// ─── Pagination ──────────────────────────────────────────────────
	let currentPage = $state(1);
	const pageSize = 20;

	// ─── Invoice List Query ──────────────────────────────────────────
	const invoicesQuery = createQuery(() => ({
		queryKey: ['attendee-invoices', currentPage, searchQuery],
		queryFn: async () => {
			const response = await dashboardDashboardInvoices({
				query: {
					page: currentPage,
					page_size: pageSize,
					search: searchQuery || undefined
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error('Failed to load invoices');
			return response.data;
		},
		enabled: !!accessToken,
		staleTime: 60_000
	}));

	const invoices = $derived(invoicesQuery.data?.results ?? []);
	const totalCount = $derived(invoicesQuery.data?.count ?? 0);
	const totalPages = $derived(Math.ceil(totalCount / pageSize));

	// ─── Detail Dialog ───────────────────────────────────────────────
	let dialogOpen = $state(false);
	let selectedInvoice = $state<AttendeeInvoiceSchema | null>(null);
	let isDownloading = $state(false);

	function openDetail(invoice: AttendeeInvoiceSchema) {
		selectedInvoice = invoice;
		dialogOpen = true;
	}

	function closeDetail() {
		dialogOpen = false;
		selectedInvoice = null;
	}

	// ─── PDF Download ────────────────────────────────────────────────
	async function downloadPdf(invoiceId: string) {
		isDownloading = true;
		try {
			const response = await dashboardDashboardInvoiceDownload({
				path: { invoice_id: invoiceId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.response.status === 404) {
				toast.error(m['myInvoices.pdfNotReady']());
				return;
			}
			if (response.error || !response.data) {
				toast.error(m['myInvoices.downloadError']());
				return;
			}
			window.open(getBackendUrl(response.data.download_url), '_blank');
		} catch {
			toast.error(m['myInvoices.downloadError']());
		} finally {
			isDownloading = false;
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────────
	function formatCurrency(amount: string, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
				parseFloat(amount)
			);
		} catch {
			return `${amount} ${currency.toUpperCase()}`;
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'issued':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'cancelled':
				return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'issued':
				return m['myInvoices.statusIssued']();
			case 'cancelled':
				return m['myInvoices.statusCancelled']();
			default:
				return status;
		}
	}
</script>

<svelte:head>
	<title>{m['myInvoices.pageTitle']()} - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Header -->
	<div class="mb-6 flex items-center gap-4">
		<a
			href="/account"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" aria-hidden="true" />
			Account
		</a>
	</div>

	<div class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight">{m['myInvoices.pageTitle']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{m['myInvoices.pageDescription']()}</p>
	</div>

	<!-- Search -->
	<div class="relative mb-6">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			type="search"
			placeholder={m['myInvoices.searchPlaceholder']()}
			value={searchInput}
			oninput={onSearchInput}
			class="pl-9"
			aria-label={m['myInvoices.searchPlaceholder']()}
		/>
	</div>

	{#if invoicesQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2
				class="h-6 w-6 animate-spin text-muted-foreground"
				aria-label={m['common.loading']()}
			/>
		</div>
	{:else if invoicesQuery.isError}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
			role="alert"
		>
			{m['referral.error']()}
		</div>
	{:else if invoices.length === 0}
		<!-- Empty State -->
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center"
		>
			<FileText class="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
			<h2 class="font-medium">{m['myInvoices.empty']()}</h2>
			<p class="mt-1 text-sm text-muted-foreground">{m['myInvoices.emptyDescription']()}</p>
		</div>
	{:else}
		<!-- Invoice Table -->
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">{m['myInvoices.invoiceNumber']()}</th>
						<th class="hidden px-4 py-3 text-left font-medium sm:table-cell">
							{m['myInvoices.seller']()}
						</th>
						<th class="hidden px-4 py-3 text-left font-medium md:table-cell">
							{m['myInvoices.date']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">{m['myInvoices.status']()}</th>
						<th class="px-4 py-3 text-right font-medium">{m['myInvoices.amount']()}</th>
						<th class="px-4 py-3 text-center font-medium">
							<span class="sr-only">{m['myInvoices.actions']()}</span>
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each invoices as invoice (invoice.id)}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-4 py-3">
								<button
									type="button"
									class="rounded font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onclick={() => openDetail(invoice)}
								>
									{invoice.invoice_number}
								</button>
								<p class="mt-0.5 text-xs text-muted-foreground sm:hidden">{invoice.seller_name}</p>
							</td>
							<td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
								{invoice.seller_name}
							</td>
							<td class="hidden px-4 py-3 text-muted-foreground md:table-cell">
								{invoice.issued_at ? formatDate(invoice.issued_at) : formatDate(invoice.created_at)}
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(
										invoice.status
									)}"
								>
									{statusLabel(invoice.status)}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-mono">
								{formatCurrency(invoice.total_gross, invoice.currency)}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => openDetail(invoice)}
										aria-label="{m['myInvoices.viewDetails']()} {invoice.invoice_number}"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										<span class="sr-only">{m['myInvoices.viewDetails']()}</span>
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => downloadPdf(invoice.id)}
										disabled={isDownloading}
										aria-label="{m['myInvoices.downloadPdf']()} {invoice.invoice_number}"
									>
										<Download class="h-4 w-4" aria-hidden="true" />
										<span class="sr-only">{m['myInvoices.downloadPdf']()}</span>
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
					aria-label={m['myInvoices.previous']()}
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
					<span class="ml-1 hidden sm:inline">{m['myInvoices.previous']()}</span>
				</Button>
				<span class="text-sm text-muted-foreground" aria-live="polite">
					{currentPage} / {totalPages}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
					aria-label={m['myInvoices.next']()}
				>
					<span class="mr-1 hidden sm:inline">{m['myInvoices.next']()}</span>
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
		{/if}
	{/if}
</div>

<!-- ─── Invoice Detail Dialog ────────────────────────────────────────── -->
<Dialog.Root bind:open={dialogOpen} onOpenChange={(open) => !open && closeDetail()}>
	<Dialog.Content class="max-h-[90vh] max-w-lg overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{m['myInvoices.detailTitle']()}</Dialog.Title>
		</Dialog.Header>

		{#if selectedInvoice}
			{@const inv = selectedInvoice}

			<div class="space-y-5 py-2">
				<!-- Invoice number + status -->
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs text-muted-foreground">{m['myInvoices.invoiceNumber']()}</p>
						<p class="text-lg font-semibold">{inv.invoice_number}</p>
					</div>
					<span
						class="mt-1 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(
							inv.status
						)}"
					>
						{statusLabel(inv.status)}
					</span>
				</div>

				<!-- Seller -->
				<div>
					<p class="text-xs text-muted-foreground">{m['myInvoices.seller']()}</p>
					<p class="font-medium">{inv.seller_name}</p>
				</div>

				<!-- Dates -->
				<div class="flex gap-6 text-sm">
					{#if inv.issued_at}
						<div>
							<p class="text-xs text-muted-foreground">{m['myInvoices.issuedAt']()}</p>
							<p>{formatDate(inv.issued_at)}</p>
						</div>
					{/if}
					<div>
						<p class="text-xs text-muted-foreground">{m['myInvoices.createdAt']()}</p>
						<p>{formatDate(inv.created_at)}</p>
					</div>
				</div>

				<!-- Line items -->
				{#if inv.line_items.length > 0}
					<div>
						<h3 class="mb-2 text-sm font-medium">{m['myInvoices.lineItems']()}</h3>
						<div class="overflow-x-auto rounded-lg border">
							<table class="w-full text-xs">
								<thead class="bg-muted/50">
									<tr>
										<th class="px-3 py-2 text-left font-medium">{m['myInvoices.description']()}</th>
										<th class="px-3 py-2 text-right font-medium">{m['myInvoices.unitPrice']()}</th>
										<th class="hidden px-3 py-2 text-right font-medium sm:table-cell">
											{m['myInvoices.discount']()}
										</th>
										<th class="px-3 py-2 text-right font-medium">{m['myInvoices.net']()}</th>
										<th class="hidden px-3 py-2 text-right font-medium sm:table-cell">
											{m['myInvoices.vat']()}
										</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each inv.line_items as item, i (i)}
										<tr>
											<td class="px-3 py-2">{item.description}</td>
											<td class="px-3 py-2 text-right font-mono">
												{formatCurrency(item.unit_price_gross, inv.currency)}
											</td>
											<td class="hidden px-3 py-2 text-right font-mono sm:table-cell">
												{#if item.discount_amount && parseFloat(item.discount_amount) > 0}
													-{formatCurrency(item.discount_amount, inv.currency)}
												{:else}
													—
												{/if}
											</td>
											<td class="px-3 py-2 text-right font-mono">
												{formatCurrency(item.net_amount, inv.currency)}
											</td>
											<td class="hidden px-3 py-2 text-right font-mono sm:table-cell">
												{formatCurrency(item.vat_amount, inv.currency)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				<!-- Amount breakdown -->
				<div class="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
					<h3 class="mb-2 font-medium">{m['myInvoices.breakdown']()}</h3>
					<dl class="space-y-1.5">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">{m['myInvoices.totalNet']()}</dt>
							<dd class="font-mono">{formatCurrency(inv.total_net, inv.currency)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">
								{m['myInvoices.totalVat']({ rate: inv.vat_rate })}
							</dt>
							<dd class="font-mono">{formatCurrency(inv.total_vat, inv.currency)}</dd>
						</div>
						<div class="flex justify-between border-t pt-1.5 font-semibold">
							<dt>{m['myInvoices.totalGross']()}</dt>
							<dd class="font-mono">{formatCurrency(inv.total_gross, inv.currency)}</dd>
						</div>
					</dl>
				</div>

				<!-- Reverse charge -->
				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">{m['myInvoices.reverseCharge']()}</span>
					<span class="font-medium">
						{#if inv.reverse_charge}
							{m['myInvoices.reverseChargeYes']()}
						{:else}
							{m['myInvoices.reverseChargeNo']()}
						{/if}
					</span>
				</div>

				<!-- Discount code -->
				{#if inv.discount_code_text}
					<div class="space-y-1 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m['myInvoices.discountCode']()}</span>
							<span class="font-mono font-medium">{inv.discount_code_text}</span>
						</div>
						{#if parseFloat(inv.discount_amount_total) > 0}
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m['myInvoices.discountTotal']()}</span>
								<span class="font-mono font-medium">
									-{formatCurrency(inv.discount_amount_total, inv.currency)}
								</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			{#if selectedInvoice}
				<Button
					onclick={() => selectedInvoice && downloadPdf(selectedInvoice.id)}
					disabled={isDownloading}
					class="gap-2"
				>
					{#if isDownloading}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{:else}
						<Download class="h-4 w-4" aria-hidden="true" />
					{/if}
					{m['myInvoices.downloadPdf']()}
				</Button>
			{/if}
			<Button variant="outline" onclick={closeDetail}>
				{m['myInvoices.close']()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
