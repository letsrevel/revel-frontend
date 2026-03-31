<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		AlertCircle,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Download,
		Edit3,
		FileText,
		Loader2,
		Search,
		Send,
		Trash2,
		X
	} from 'lucide-svelte';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { getBackendUrl } from '$lib/config/api';
	import {
		organizationadminvatListAttendeeInvoices,
		organizationadminvatGetAttendeeInvoice,
		organizationadminvatUpdateAttendeeInvoice,
		organizationadminvatIssueAttendeeInvoice,
		organizationadminvatDeleteAttendeeInvoice,
		organizationadminvatDownloadAttendeeInvoice
	} from '$lib/api/generated/sdk.gen';
	import type { AttendeeInvoiceDetailSchema } from '$lib/api/generated/types.gen';
	import type { LayoutData } from '../../$types';

	interface Props {
		data: LayoutData;
	}
	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const headers = $derived({ Authorization: `Bearer ${accessToken}` });
	const queryClient = useQueryClient();
	const errMsg = () => m['orgAdmin.billing.attendeeInvoices.error']();
	let currentPage = $state(1);
	const pageSize = 20;
	let searchInput = $state('');
	let searchDebounced = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function handleSearch(value: string) {
		searchInput = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchDebounced = value;
			currentPage = 1;
		}, 300);
	}

	let selectedInvoiceId = $state<string | null>(null);
	let isEditing = $state(false);
	let showIssueDialog = $state(false);
	let showDeleteDialog = $state(false);
	let actionInvoiceId = $state<string | null>(null);
	let editBuyerName = $state('');
	let editBuyerEmail = $state('');
	let editBuyerVatId = $state('');
	let editBuyerCountry = $state('');
	let editBuyerAddress = $state('');

	const invoicesQuery = browser
		? createQuery(() => ({
				queryKey: ['attendee-invoices', slug, currentPage, searchDebounced],
				queryFn: async () => {
					const response = await organizationadminvatListAttendeeInvoices({
						path: { slug },
						query: {
							page: currentPage,
							page_size: pageSize,
							...(searchDebounced ? { search: searchDebounced } : {})
						},
						headers
					});
					if (response.error) throw new Error('Failed to load attendee invoices');
					return response.data!;
				},
				enabled: !!accessToken
			}))
		: null;
	const totalPages = $derived(
		invoicesQuery?.data ? Math.ceil(invoicesQuery.data.count / pageSize) : 0
	);
	const detailQuery = browser
		? createQuery(() => ({
				queryKey: ['attendee-invoice-detail', slug, selectedInvoiceId],
				queryFn: async () => {
					if (!selectedInvoiceId) throw new Error('No invoice selected');
					const response = await organizationadminvatGetAttendeeInvoice({
						path: { slug, invoice_id: selectedInvoiceId },
						headers
					});
					if (response.error) throw new Error('Failed to load invoice');
					return response.data!;
				},
				enabled: !!accessToken && !!selectedInvoiceId
			}))
		: null;
	const updateMutation = browser
		? createMutation(() => ({
				mutationFn: async () => {
					if (!selectedInvoiceId) throw new Error('No invoice selected');
					const response = await organizationadminvatUpdateAttendeeInvoice({
						path: { slug, invoice_id: selectedInvoiceId },
						headers,
						body: {
							buyer_name: editBuyerName || null,
							buyer_email: editBuyerEmail || null,
							buyer_vat_id: editBuyerVatId || null,
							buyer_vat_country: editBuyerCountry || null,
							buyer_address: editBuyerAddress || null
						}
					});
					if (response.error) throw new Error(extractErrorMessage(response.error, errMsg()));
					return response.data!;
				},
				onSuccess: () => {
					isEditing = false;
					queryClient.invalidateQueries({
						queryKey: ['attendee-invoice-detail', slug, selectedInvoiceId]
					});
					queryClient.invalidateQueries({ queryKey: ['attendee-invoices', slug] });
					toast.success(m['orgAdmin.billing.attendeeInvoices.saved']());
				},
				onError: (error: Error) => toast.error(error.message)
			}))
		: null;
	const issueMutation = browser
		? createMutation(() => ({
				mutationFn: async (invoiceId: string) => {
					const response = await organizationadminvatIssueAttendeeInvoice({
						path: { slug, invoice_id: invoiceId },
						headers
					});
					if (response.error) throw new Error(extractErrorMessage(response.error, errMsg()));
					return response.data!;
				},
				onSuccess: () => {
					showIssueDialog = false;
					actionInvoiceId = null;
					queryClient.invalidateQueries({ queryKey: ['attendee-invoices', slug] });
					if (selectedInvoiceId)
						queryClient.invalidateQueries({
							queryKey: ['attendee-invoice-detail', slug, selectedInvoiceId]
						});
					toast.success(m['orgAdmin.billing.attendeeInvoices.issued']());
				},
				onError: (error: Error) => toast.error(error.message)
			}))
		: null;
	const deleteMutation = browser
		? createMutation(() => ({
				mutationFn: async (invoiceId: string) => {
					const response = await organizationadminvatDeleteAttendeeInvoice({
						path: { slug, invoice_id: invoiceId },
						headers
					});
					if (response.error) throw new Error(extractErrorMessage(response.error, errMsg()));
				},
				onSuccess: () => {
					showDeleteDialog = false;
					const deletedId = actionInvoiceId;
					actionInvoiceId = null;
					if (selectedInvoiceId === deletedId) selectedInvoiceId = null;
					queryClient.invalidateQueries({ queryKey: ['attendee-invoices', slug] });
					toast.success(m['orgAdmin.billing.attendeeInvoices.deleted']());
				},
				onError: (error: Error) => toast.error(error.message)
			}))
		: null;
	const downloadMutation = browser
		? createMutation(() => ({
				mutationFn: async (invoiceId: string) => {
					const response = await organizationadminvatDownloadAttendeeInvoice({
						path: { slug, invoice_id: invoiceId },
						headers
					});
					if (response.error)
						throw new Error(m['orgAdmin.billing.attendeeInvoices.downloadError']());
					return response.data!;
				},
				onSuccess: (data) => {
					window.open(getBackendUrl(data.download_url), '_blank');
				},
				onError: (error: Error) => toast.error(error.message)
			}))
		: null;

	function formatCurrency(amount: string, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
				parseFloat(amount)
			);
		} catch {
			return `${amount} ${currency}`;
		}
	}

	const STATUS_COLORS: Record<string, string> = {
		issued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
		draft: 'bg-muted text-muted-foreground',
		cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
	};
	function statusColor(s: string) {
		return STATUS_COLORS[s] ?? 'bg-muted text-muted-foreground';
	}
	function statusLabel(s: string) {
		const l: Record<string, () => string> = {
			draft: () => m['orgAdmin.billing.attendeeInvoices.statusDraft'](),
			issued: () => m['orgAdmin.billing.attendeeInvoices.statusIssued'](),
			cancelled: () => m['orgAdmin.billing.attendeeInvoices.statusCancelled']()
		};
		return l[s]?.() ?? s;
	}
	function openDetail(invoice: AttendeeInvoiceDetailSchema) {
		selectedInvoiceId = invoice.id;
		isEditing = false;
	}
	function closeDetail() {
		selectedInvoiceId = null;
		isEditing = false;
	}

	function startEdit(inv: AttendeeInvoiceDetailSchema) {
		editBuyerName = inv.buyer_name || '';
		editBuyerEmail = inv.buyer_email || '';
		editBuyerVatId = inv.buyer_vat_id || '';
		editBuyerCountry = inv.buyer_vat_country || '';
		editBuyerAddress = inv.buyer_address || '';
		isEditing = true;
	}
	function formatDate(d: string) {
		return new Date(d).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
	function openAction(invoiceId: string, type: 'issue' | 'delete') {
		actionInvoiceId = invoiceId;
		if (type === 'issue') showIssueDialog = true;
		else showDeleteDialog = true;
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.attendeeInvoices.title']()} - {data.organization.name}</title>
</svelte:head>

<div class="space-y-6 px-4">
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
				{m['orgAdmin.billing.attendeeInvoices.title']()}
			</h1>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.attendeeInvoices.description']()}
			</p>
		</div>
	</div>

	<div class="relative max-w-sm">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			type="search"
			placeholder={m['orgAdmin.billing.attendeeInvoices.searchPlaceholder']()}
			value={searchInput}
			oninput={(e) => handleSearch(e.currentTarget.value)}
			class="pl-10"
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
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center"
		>
			<FileText class="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.empty']()}</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.billing.attendeeInvoices.emptyDescription']()}
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium"
							>{m['orgAdmin.billing.attendeeInvoices.invoiceNumber']()}</th
						>
						<th class="px-4 py-3 text-left font-medium"
							>{m['orgAdmin.billing.attendeeInvoices.buyer']()}</th
						>
						<th class="px-4 py-3 text-left font-medium"
							>{m['orgAdmin.billing.attendeeInvoices.status']()}</th
						>
						<th class="px-4 py-3 text-right font-medium"
							>{m['orgAdmin.billing.attendeeInvoices.amount']()}</th
						>
						<th class="px-4 py-3 text-left font-medium"
							>{m['orgAdmin.billing.attendeeInvoices.date']()}</th
						>
						<th class="px-4 py-3 text-center font-medium"
							><span class="sr-only">{m['common.actions']()}</span></th
						>
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
							<td class="px-4 py-3">
								<div>{invoice.buyer_name}</div>
								<div class="text-xs text-muted-foreground">{invoice.buyer_email}</div>
							</td>
							<td class="px-4 py-3">
								<span
									class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(
										invoice.status
									)}">{statusLabel(invoice.status)}</span
								>
							</td>
							<td class="px-4 py-3 text-right font-mono"
								>{formatCurrency(invoice.total_gross, invoice.currency)}</td
							>
							<td class="px-4 py-3 text-muted-foreground"
								>{formatDate(invoice.issued_at || invoice.created_at)}</td
							>
							<td class="px-4 py-3 text-center">
								<div class="flex items-center justify-center gap-1">
									{#if invoice.status === 'draft'}
										<Button
											variant="ghost"
											size="sm"
											onclick={(e) => {
												e.stopPropagation();
												openAction(invoice.id, 'issue');
											}}
											aria-label={m['orgAdmin.billing.attendeeInvoices.issue']()}
										>
											<Send class="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={(e) => {
												e.stopPropagation();
												openAction(invoice.id, 'delete');
											}}
											aria-label={m['orgAdmin.billing.attendeeInvoices.deleteInvoice']()}
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									{:else}
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
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">{invoicesQuery.data.count} invoices</p>
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
					<span class="text-sm">{currentPage} / {totalPages}</span>
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

<Dialog
	open={!!selectedInvoiceId}
	onOpenChange={(open) => {
		if (!open) closeDetail();
	}}
>
	<DialogContent class="max-h-[90vh] max-w-xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.billing.attendeeInvoices.detailTitle']()}</DialogTitle>
		</DialogHeader>
		{#if detailQuery?.isLoading}
			<div class="flex items-center justify-center py-8">
				<Loader2
					class="h-6 w-6 animate-spin text-muted-foreground"
					aria-label={m['common.loading']()}
				/>
			</div>
		{:else if detailQuery?.error}
			<div
				class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
				role="alert"
			>
				<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
				<p class="text-sm">{extractErrorMessage(detailQuery.error)}</p>
			</div>
		{:else if detailQuery?.data}
			{@const inv = detailQuery.data}
			<div class="space-y-5 py-2">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.billing.attendeeInvoices.invoiceNumber']()}
						</p>
						<p class="text-lg font-semibold">{inv.invoice_number}</p>
					</div>
					<span
						class="mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(inv.status)}"
						>{statusLabel(inv.status)}</span
					>
				</div>

				{#if isEditing}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							updateMutation?.mutate();
						}}
						class="space-y-2"
					>
						<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.edit']()}</h3>
						<div>
							<Label for="edit-buyer-name">{m['orgAdmin.billing.attendeeInvoices.name']()}</Label
							><Input id="edit-buyer-name" bind:value={editBuyerName} />
						</div>
						<div>
							<Label for="edit-buyer-email">{m['orgAdmin.billing.attendeeInvoices.email']()}</Label
							><Input id="edit-buyer-email" type="email" bind:value={editBuyerEmail} />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<Label for="edit-buyer-vat-id"
									>{m['orgAdmin.billing.attendeeInvoices.vatId']()}</Label
								><Input id="edit-buyer-vat-id" bind:value={editBuyerVatId} class="uppercase" />
							</div>
							<div>
								<Label for="edit-buyer-country"
									>{m['orgAdmin.billing.attendeeInvoices.country']()}</Label
								><Input id="edit-buyer-country" bind:value={editBuyerCountry} class="uppercase" />
							</div>
						</div>
						<div>
							<Label for="edit-buyer-address"
								>{m['orgAdmin.billing.attendeeInvoices.address']()}</Label
							><Input id="edit-buyer-address" bind:value={editBuyerAddress} />
						</div>
						<div class="flex gap-2">
							<Button type="submit" disabled={updateMutation?.isPending}>
								{#if updateMutation?.isPending}<Loader2
										class="mr-2 h-4 w-4 animate-spin"
										aria-hidden="true"
									/>{/if}
								{m['orgAdmin.billing.attendeeInvoices.save']()}
							</Button>
							<Button type="button" variant="outline" onclick={() => (isEditing = false)}
								>{m['common.cancel']()}</Button
							>
						</div>
					</form>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1 text-sm">
							<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.buyerInfo']()}</h3>
							<p>{inv.buyer_name}</p>
							<p class="text-muted-foreground">{inv.buyer_email}</p>
							{#if inv.buyer_address}<p class="text-muted-foreground">{inv.buyer_address}</p>{/if}
							{#if inv.buyer_vat_id}<p class="text-muted-foreground">
									VAT: {inv.buyer_vat_id}
								</p>{/if}
							{#if inv.buyer_vat_country}<p class="text-muted-foreground">
									{inv.buyer_vat_country}
								</p>{/if}
						</div>
						<div class="space-y-1 text-sm">
							<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.sellerInfo']()}</h3>
							<p>{inv.seller_name}</p>
							{#if inv.seller_email}<p class="text-muted-foreground">{inv.seller_email}</p>{/if}
							{#if inv.seller_address}<p class="text-muted-foreground">{inv.seller_address}</p>{/if}
							{#if inv.seller_vat_id}<p class="text-muted-foreground">
									VAT: {inv.seller_vat_id}
								</p>{/if}
							{#if inv.seller_vat_country}<p class="text-muted-foreground">
									{inv.seller_vat_country}
								</p>{/if}
						</div>
					</div>

					{#if inv.line_items?.length}
						<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
							<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.lineItems']()}</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm">
									<thead>
										<tr class="text-left text-muted-foreground">
											<th class="pb-2 pr-4"
												>{m['orgAdmin.billing.attendeeInvoices.lineDescription']()}</th
											>
											<th class="pb-2 pr-4 text-right"
												>{m['orgAdmin.billing.attendeeInvoices.unitPrice']()}</th
											>
											<th class="pb-2 pr-4 text-right"
												>{m['orgAdmin.billing.attendeeInvoices.net']()}</th
											>
											<th class="pb-2 text-right">{m['orgAdmin.billing.attendeeInvoices.vat']()}</th
											>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/50">
										{#each inv.line_items as item}
											<tr>
												<td class="py-2 pr-4">{item.description}</td>
												<td class="py-2 pr-4 text-right font-mono"
													>{formatCurrency(item.unit_price_gross, inv.currency)}</td
												>
												<td class="py-2 pr-4 text-right font-mono"
													>{formatCurrency(item.net_amount, inv.currency)}</td
												>
												<td class="py-2 text-right font-mono"
													>{formatCurrency(item.vat_amount, inv.currency)}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<div class="space-y-2 rounded-lg border bg-muted/30 p-4">
						<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.breakdown']()}</h3>
						<dl class="space-y-1 text-sm">
							<div class="flex justify-between">
								<dt class="text-muted-foreground">
									{m['orgAdmin.billing.attendeeInvoices.totalNet']()}
								</dt>
								<dd class="font-mono">{formatCurrency(inv.total_net, inv.currency)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-muted-foreground">
									{m['orgAdmin.billing.attendeeInvoices.totalVat']({ rate: inv.vat_rate })}
								</dt>
								<dd class="font-mono">{formatCurrency(inv.total_vat, inv.currency)}</dd>
							</div>
							<div class="flex justify-between border-t pt-1.5 font-medium">
								<dt>{m['orgAdmin.billing.attendeeInvoices.totalGross']()}</dt>
								<dd class="font-mono">{formatCurrency(inv.total_gross, inv.currency)}</dd>
							</div>
						</dl>
					</div>

					{#if inv.reverse_charge}
						<p class="text-sm text-muted-foreground">
							{m['orgAdmin.billing.attendeeInvoices.reverseCharge']()}: {m[
								'orgAdmin.billing.attendeeInvoices.reverseChargeYes'
							]()}
						</p>
					{/if}

					{#if inv.discount_code_text || parseFloat(inv.discount_amount_total) > 0}
						<div class="text-sm">
							<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.discountCode']()}</h3>
							{#if inv.discount_code_text}<p class="text-muted-foreground">
									{inv.discount_code_text}
								</p>{/if}
							{#if parseFloat(inv.discount_amount_total) > 0}<p class="text-muted-foreground">
									-{formatCurrency(inv.discount_amount_total, inv.currency)}
								</p>{/if}
						</div>
					{/if}

					<div class="flex flex-col gap-2">
						{#if inv.status === 'draft'}
							<Button variant="outline" class="w-full" onclick={() => startEdit(inv)}>
								<Edit3 class="mr-2 h-4 w-4" aria-hidden="true" />{m[
									'orgAdmin.billing.attendeeInvoices.edit'
								]()}
							</Button>
							<Button class="w-full" onclick={() => openAction(inv.id, 'issue')}>
								<Send class="mr-2 h-4 w-4" aria-hidden="true" />{m[
									'orgAdmin.billing.attendeeInvoices.issue'
								]()}
							</Button>
							<Button
								variant="destructive"
								class="w-full"
								onclick={() => openAction(inv.id, 'delete')}
							>
								<Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />{m[
									'orgAdmin.billing.attendeeInvoices.deleteInvoice'
								]()}
							</Button>
						{:else}
							<Button
								class="w-full"
								onclick={() => downloadMutation?.mutate(inv.id)}
								disabled={downloadMutation?.isPending}
							>
								{#if downloadMutation?.isPending}<Loader2
										class="mr-2 h-4 w-4 animate-spin"
										aria-hidden="true"
									/>{:else}<Download class="mr-2 h-4 w-4" aria-hidden="true" />{/if}
								{m['orgAdmin.billing.attendeeInvoices.downloadPdf']()}
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		<DialogFooter>
			<Button variant="outline" onclick={closeDetail}>{m['common.close']()}</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

{#snippet confirmDialog(
	open: boolean,
	onOpenChange: (v: boolean) => void,
	title: string,
	description: string,
	buttonLabel: string,
	onConfirm: () => void,
	isPending: boolean,
	variant: 'default' | 'destructive'
)}
	<Dialog {open} {onOpenChange}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button variant="outline" onclick={() => onOpenChange(false)}>{m['common.cancel']()}</Button
				>
				<Button {variant} onclick={onConfirm} disabled={isPending}>
					{#if isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{/if}
					{buttonLabel}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/snippet}

{@render confirmDialog(
	showIssueDialog,
	(open) => (showIssueDialog = open),
	m['orgAdmin.billing.attendeeInvoices.issueConfirmTitle'](),
	m['orgAdmin.billing.attendeeInvoices.issueConfirmDescription'](),
	m['orgAdmin.billing.attendeeInvoices.issueConfirmButton'](),
	() => actionInvoiceId && issueMutation?.mutate(actionInvoiceId),
	issueMutation?.isPending ?? false,
	'default'
)}

{@render confirmDialog(
	showDeleteDialog,
	(open) => (showDeleteDialog = open),
	m['orgAdmin.billing.attendeeInvoices.deleteConfirmTitle'](),
	m['orgAdmin.billing.attendeeInvoices.deleteConfirmDescription'](),
	m['orgAdmin.billing.attendeeInvoices.deleteConfirmButton'](),
	() => actionInvoiceId && deleteMutation?.mutate(actionInvoiceId),
	deleteMutation?.isPending ?? false,
	'destructive'
)}
