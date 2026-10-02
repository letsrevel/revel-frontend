<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		AlertCircle,
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		FileCheck2,
		Loader2,
		Search
	} from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		organizationadminvatListSkippedFiscalDocuments,
		organizationadminvatResolveSkippedFiscalDocument
	} from '$lib/api/generated/sdk.gen';
	import type {
		SkippedFiscalDocumentKind,
		SkippedFiscalDocumentSchema
	} from '$lib/api/generated/types.gen';
	import type { LayoutData } from '../../$types';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import SkippedFiscalDocumentsTable from '$lib/components/compliance/SkippedFiscalDocumentsTable.svelte';
	import ResolveSkippedDocumentDialog from '$lib/components/compliance/ResolveSkippedDocumentDialog.svelte';
	import {
		kindLabel,
		resolveActionId,
		resolvedQueryParam,
		resolveErrorMessage,
		type SkippedStatusFilter
	} from '$lib/components/compliance/skipped-documents';

	// Owner-only like the rest of billing (the layout 403s staff); the backend
	// refuses staff too (#1008).
	interface Props {
		data: LayoutData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	const uid = $props.id();

	let currentPage = $state(1);
	const pageSize = 20;
	let statusFilter = $state<SkippedStatusFilter>('open');
	let kindFilter = $state<SkippedFiscalDocumentKind | ''>('');
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

	function setStatus(value: SkippedStatusFilter) {
		statusFilter = value;
		currentPage = 1;
	}

	const documentsQuery = browser
		? createQuery(() => ({
				queryKey: [
					'skipped-fiscal-documents',
					slug,
					currentPage,
					statusFilter,
					kindFilter,
					searchDebounced
				],
				queryFn: async () => {
					const resolved = resolvedQueryParam(statusFilter);
					const response = await organizationadminvatListSkippedFiscalDocuments({
						path: { slug },
						query: {
							page: currentPage,
							page_size: pageSize,
							...(resolved !== undefined ? { resolved } : {}),
							...(kindFilter ? { kind: kindFilter } : {}),
							...(searchDebounced ? { search: searchDebounced } : {})
						},
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error || !response.data)
						throw new Error(m['compliance.skipped.loadFailed']());
					return response.data;
				},
				enabled: !!accessToken
			}))
		: null;

	const totalPages = $derived(
		documentsQuery?.data ? Math.ceil(documentsQuery.data.count / pageSize) : 0
	);
	const filtered = $derived(statusFilter !== 'open' || !!kindFilter || !!searchDebounced);

	// ─── Resolve ────────────────────────────────────────────────────
	let resolving = $state<SkippedFiscalDocumentSchema | null>(null);
	let dialogOpen = $state(false);

	function openResolve(doc: SkippedFiscalDocumentSchema) {
		resolving = doc;
		dialogOpen = true;
	}

	async function saveReference(reference: string): Promise<void> {
		const doc = resolving;
		if (!doc) return;
		const response = await organizationadminvatResolveSkippedFiscalDocument({
			path: { slug, document_id: doc.id },
			body: { external_reference: reference },
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (response.error || !response.data) throw new Error(resolveErrorMessage(response.error));
		// Refetch before the dialog closes, so focus lands on the list as it now is.
		await queryClient.invalidateQueries({ queryKey: ['skipped-fiscal-documents', slug] });
		toast.success(m['compliance.skipped.saved']());
	}

	async function returnFocus() {
		const id = resolving ? resolveActionId(resolving.id) : null;
		await tick();
		// A resolved row leaves the "To issue" view: fall back to the heading.
		const target = (id && document.getElementById(id)) || document.getElementById(`${uid}-heading`);
		target?.focus();
	}

	const statusOptions: { value: SkippedStatusFilter; label: () => string }[] = [
		{ value: 'open', label: m['compliance.skipped.statusOpen'] },
		{ value: 'done', label: m['compliance.skipped.statusDone'] },
		{ value: 'all', label: m['compliance.skipped.filterAll'] }
	];
</script>

<svelte:head>
	<title>{m['compliance.skipped.title']()} - {data.organization.name}</title>
</svelte:head>

<div class="space-y-6 px-4">
	<div class="flex items-center gap-3">
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing', { slug })}
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			aria-label={m['common.backToBilling']()}
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<PageHeader
			id="{uid}-heading"
			tabindex={-1}
			title={m['compliance.skipped.title']()}
			subtitle={m['compliance.skipped.intro']()}
			class="flex-1 focus:outline-none"
		/>
	</div>

	<div class="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
		<div role="group" aria-labelledby="{uid}-status-label">
			<span id="{uid}-status-label" class="mb-2 block text-sm font-semibold">
				{m['compliance.skipped.filterStatus']()}
			</span>
			<div class="flex flex-wrap gap-2">
				{#each statusOptions as option (option.value)}
					<button
						type="button"
						aria-pressed={statusFilter === option.value}
						onclick={() => setStatus(option.value)}
						class="rounded-md border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {statusFilter ===
						option.value
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
					>
						{option.label()}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<label for="{uid}-kind" class="mb-2 block text-sm font-semibold">
				{m['compliance.skipped.filterKind']()}
			</label>
			<select
				id="{uid}-kind"
				bind:value={kindFilter}
				onchange={() => (currentPage = 1)}
				class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-56"
			>
				<option value="">{m['compliance.skipped.filterKindAll']()}</option>
				<option value="invoice">{kindLabel('invoice')}</option>
				<option value="credit_note">{kindLabel('credit_note')}</option>
			</select>
		</div>

		<div class="relative md:w-80">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				type="search"
				placeholder={m['compliance.skipped.searchPlaceholder']()}
				aria-label={m['compliance.skipped.searchLabel']()}
				value={searchInput}
				oninput={(e) => handleSearch(e.currentTarget.value)}
				class="pl-10"
			/>
		</div>
	</div>

	{#if documentsQuery?.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2
				class="h-6 w-6 animate-spin text-muted-foreground"
				aria-label={m['common.loading']()}
			/>
		</div>
	{:else if documentsQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm">{documentsQuery.error.message}</p>
		</div>
	{:else if !documentsQuery?.data?.results?.length}
		<EmptyState
			icon={FileCheck2}
			title={filtered ? m['compliance.skipped.emptyFiltered']() : m['compliance.skipped.empty']()}
		/>
	{:else}
		<SkippedFiscalDocumentsTable
			documents={documentsQuery.data.results}
			orgSlug={slug}
			onResolve={openResolve}
		/>

		{#if totalPages > 1}
			<div class="flex items-center justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					aria-label={m['common.paginationPrevious']()}
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				</Button>
				<span class="text-sm">{currentPage} / {totalPages}</span>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					aria-label={m['common.paginationNext']()}
					onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
				>
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
		{/if}
	{/if}
</div>

<ResolveSkippedDocumentDialog
	open={dialogOpen}
	subject={resolving
		? `${kindLabel(resolving.kind)} · ${resolving.buyer_name || resolving.buyer_email}`
		: ''}
	initialReference={resolving?.external_reference ?? ''}
	onSave={saveReference}
	onOpenChange={(v) => (dialogOpen = v)}
	{returnFocus}
/>
