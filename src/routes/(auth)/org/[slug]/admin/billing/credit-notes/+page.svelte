<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertCircle,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		FileText,
		Loader2
	} from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { organizationadminvatListCreditNotes } from '$lib/api/generated/sdk.gen';
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

	// ─── Credit Notes Query ─────────────────────────────────────────
	const creditNotesQuery = browser
		? createQuery(() => ({
				queryKey: ['credit-notes', slug, currentPage],
				queryFn: async () => {
					const response = await organizationadminvatListCreditNotes({
						path: { slug },
						query: { page: currentPage, page_size: pageSize },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error) throw new Error('Failed to load credit notes');
					return response.data!;
				},
				enabled: !!accessToken
			}))
		: null;

	const totalPages = $derived(
		creditNotesQuery?.data ? Math.ceil(creditNotesQuery.data.count / pageSize) : 0
	);

	function formatCurrency(amount: string, currency = 'EUR'): string {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
				parseFloat(amount)
			);
		} catch {
			return amount;
		}
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.creditNotes.title']()} - {data.organization.name}</title>
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
				{m['orgAdmin.billing.creditNotes.title']()}
			</h1>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.creditNotes.description']()}
			</p>
		</div>
	</div>

	{#if creditNotesQuery?.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2
				class="h-6 w-6 animate-spin text-muted-foreground"
				aria-label={m['common.loading']()}
			/>
		</div>
	{:else if creditNotesQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm">{extractErrorMessage(creditNotesQuery.error)}</p>
		</div>
	{:else if !creditNotesQuery?.data?.results?.length}
		<!-- Empty State -->
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center"
		>
			<FileText class="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
			<h3 class="font-medium">{m['orgAdmin.billing.creditNotes.empty']()}</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.billing.creditNotes.emptyDescription']()}
			</p>
		</div>
	{:else}
		<!-- Credit Notes Table -->
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.creditNotes.columns.creditNoteNumber']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.creditNotes.columns.linkedInvoice']()}
						</th>
						<th class="px-4 py-3 text-right font-medium">
							{m['orgAdmin.billing.creditNotes.columns.grossAmount']()}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each creditNotesQuery.data.results as note (note.id)}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-4 py-3 font-medium">{note.credit_note_number}</td>
							<td class="px-4 py-3 text-muted-foreground">
								<a
									href="/org/{slug}/admin/billing/invoices?invoice={note.invoice_id}"
									class="underline underline-offset-2 hover:text-foreground"
								>
									{note.invoice_id}
								</a>
							</td>
							<td class="px-4 py-3 text-right font-mono">
								{formatCurrency(note.fee_gross)}
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
					{creditNotesQuery.data.count} credit note{creditNotesQuery.data.count === 1 ? '' : 's'}
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
