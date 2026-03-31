<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		AlertCircle,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		FileText,
		Loader2,
		Search
	} from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { organizationadminvatListAttendeeCreditNotes } from '$lib/api/generated/sdk.gen';
	import type { LayoutData } from '../../$types';

	interface Props {
		data: LayoutData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);

	// Pagination & search
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

	// ─── Credit Notes Query ─────────────────────────────────────────
	const creditNotesQuery = browser
		? createQuery(() => ({
				queryKey: ['attendee-credit-notes', slug, currentPage, searchDebounced],
				queryFn: async () => {
					const response = await organizationadminvatListAttendeeCreditNotes({
						path: { slug },
						query: {
							page: currentPage,
							page_size: pageSize,
							...(searchDebounced ? { search: searchDebounced } : {})
						},
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error) throw new Error('Failed to load attendee credit notes');
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

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.attendeeCreditNotes.title']()} - {data.organization.name}</title>
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
				{m['orgAdmin.billing.attendeeCreditNotes.title']()}
			</h1>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.attendeeCreditNotes.description']()}
			</p>
		</div>
	</div>

	<!-- Search -->
	<div class="relative max-w-sm">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			type="search"
			placeholder={m['orgAdmin.billing.attendeeCreditNotes.searchPlaceholder']()}
			value={searchInput}
			oninput={(e) => handleSearch(e.currentTarget.value)}
			class="pl-10"
		/>
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
			<h3 class="font-medium">{m['orgAdmin.billing.attendeeCreditNotes.empty']()}</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.billing.attendeeCreditNotes.emptyDescription']()}
			</p>
		</div>
	{:else}
		<!-- Credit Notes Table -->
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.attendeeCreditNotes.creditNoteNumber']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.attendeeCreditNotes.linkedInvoice']()}
						</th>
						<th class="px-4 py-3 text-right font-medium">
							{m['orgAdmin.billing.attendeeCreditNotes.amount']()}
						</th>
						<th class="px-4 py-3 text-left font-medium">
							{m['orgAdmin.billing.attendeeCreditNotes.issuedAt']()}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each creditNotesQuery.data.results as note (note.id)}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-4 py-3 font-medium">{note.credit_note_number}</td>
							<td class="px-4 py-3 text-muted-foreground">
								<a
									href="/org/{slug}/admin/billing/attendee-invoices"
									class="underline underline-offset-2 hover:text-foreground"
								>
									{note.invoice_number}
								</a>
							</td>
							<td class="px-4 py-3 text-right font-mono">
								{formatCurrency(note.amount_gross)}
							</td>
							<td class="px-4 py-3 text-muted-foreground">
								{formatDate(note.issued_at || note.created_at)}
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
					{creditNotesQuery.data.count} credit notes
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
