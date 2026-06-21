<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadmindiscountcodesListDiscountCodes,
		organizationadmindiscountcodesDeleteDiscountCode,
		organizationadmindiscountcodesUpdateDiscountCode
	} from '$lib/api/generated/sdk.gen';
	import type { DiscountCodeSchema, DiscountType } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		Plus,
		Search,
		Tag,
		Pencil,
		Trash2,
		PowerOff,
		ToggleLeft,
		ToggleRight,
		ChevronLeft,
		ChevronRight,
		AlertCircle,
		Copy,
		Check
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
	import * as m from '$lib/paraglide/messages.js';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Copy-to-clipboard state (tracks which code ID was just copied)
	let copiedCodeId = $state<string | null>(null);

	function copyCode(codeId: string | null | undefined, codeText: string): void {
		navigator.clipboard.writeText(codeText);
		copiedCodeId = codeId ?? null;
		setTimeout(() => (copiedCodeId = null), 2000);
	}

	// Filters
	let searchQuery = $state('');
	let activeFilter = $state<'all' | 'active' | 'inactive'>('all');
	let typeFilter = $state<'all' | DiscountType>('all');
	let currentPage = $state(1);
	const pageSize = 20;

	// Query
	const codesQuery = createQuery(() => ({
		queryKey: [
			'discount-codes',
			organization.slug,
			searchQuery,
			activeFilter,
			typeFilter,
			currentPage
		],
		queryFn: async () => {
			const response = await organizationadmindiscountcodesListDiscountCodes({
				path: { slug: organization.slug },
				query: {
					search: searchQuery || undefined,
					is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
					discount_type: typeFilter === 'all' ? undefined : typeFilter,
					page: currentPage,
					page_size: pageSize
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load discount codes');
			return response.data;
		}
	}));

	const codes = $derived(codesQuery.data?.results || []);
	const totalCount = $derived(codesQuery.data?.count || 0);
	const totalPages = $derived(Math.ceil(totalCount / pageSize));
	const isLoading = $derived(codesQuery.isLoading);
	const error = $derived(codesQuery.error);

	// Delete mutation. The endpoint hard-deletes an unused code (row gone, code
	// string freed for reuse) or deactivates a used one (history preserved), and
	// reports which via `action`.
	const deleteMutation = createMutation(() => ({
		mutationFn: async (codeId: string) => {
			const response = await organizationadmindiscountcodesDeleteDiscountCode({
				path: { slug: organization.slug, code_id: codeId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error('Failed to delete discount code');
			return response.data.action;
		},
		onSuccess: (action) => {
			queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
			if (action === 'deactivated') {
				toast.success(m['discountCodesAdmin.toast.deactivated']());
			} else {
				toast.success(m['discountCodesAdmin.toast.deleted']());
			}
		},
		onError: () => {
			toast.error(m['discountCodesAdmin.toast.deleteError']());
		}
	}));

	// Toggle active mutation
	const toggleActiveMutation = createMutation(() => ({
		mutationFn: async ({ codeId, isActive }: { codeId: string; isActive: boolean }) => {
			const response = await organizationadmindiscountcodesUpdateDiscountCode({
				path: { slug: organization.slug, code_id: codeId },
				body: { is_active: isActive },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to update discount code');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
		}
	}));

	// Best-guess at the delete outcome for the icon/confirm copy. The backend
	// hard-deletes only when a code is both unused AND has no ticket references;
	// the client can't see ticket references, so this is a heuristic on
	// times_used. The confirm copy and the success toast (driven by the
	// response `action`) cover the deactivate fallback honestly.
	function willHardDelete(code: DiscountCodeSchema): boolean {
		return (code.times_used ?? 0) === 0;
	}

	function handleDelete(code: DiscountCodeSchema) {
		const message = willHardDelete(code)
			? m['discountCodesAdmin.delete.confirmHardDelete']({ code: code.code })
			: m['discountCodesAdmin.delete.confirmDeactivate']({ code: code.code });
		if (confirm(message)) {
			if (code.id) deleteMutation.mutate(code.id);
		}
	}

	function handleToggleActive(code: DiscountCodeSchema) {
		if (code.id) {
			toggleActiveMutation.mutate({ codeId: code.id, isActive: !code.is_active });
		}
	}

	function formatValue(code: DiscountCodeSchema): string {
		if (code.discount_type === 'percentage') {
			return `${code.discount_value}%`;
		}
		const prefix = code.currency ? `${code.currency} ` : '';
		return `${prefix}${code.discount_value}`;
	}

	function formatUsage(code: DiscountCodeSchema): string {
		const used = code.times_used ?? 0;
		const max = code.max_uses;
		return max ? `${used} / ${max}` : `${used} / ∞`;
	}

	function formatScope(code: DiscountCodeSchema): string {
		const parts: string[] = [];
		if (code.series_ids && code.series_ids.length > 0) {
			parts.push(m['discountCodesAdmin.scope.series']({ count: code.series_ids.length }));
		}
		if (code.event_ids && code.event_ids.length > 0) {
			const n = code.event_ids.length;
			parts.push(
				n === 1
					? m['discountCodesAdmin.scope.event']({ count: n })
					: m['discountCodesAdmin.scope.events']({ count: n })
			);
		}
		if (code.tier_ids && code.tier_ids.length > 0) {
			const n = code.tier_ids.length;
			parts.push(
				n === 1
					? m['discountCodesAdmin.scope.tier']({ count: n })
					: m['discountCodesAdmin.scope.tiers']({ count: n })
			);
		}
		return parts.length > 0 ? parts.join(', ') : m['discountCodesAdmin.scope.orgWide']();
	}

	function formatDateRange(code: DiscountCodeSchema): string {
		if (!code.valid_from && !code.valid_until) return m['discountCodesAdmin.dateRange.always']();
		const from = code.valid_from
			? formatDate(code.valid_from)
			: m['discountCodesAdmin.dateRange.now']();
		const until = code.valid_until
			? formatDate(code.valid_until)
			: m['discountCodesAdmin.dateRange.noExpiry']();
		return `${from} → ${until}`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['discountCodesAdmin.heading']()}
			</h1>
			<p class="text-muted-foreground">{m['discountCodesAdmin.description']()}</p>
		</div>

		<Button onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/new`)}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['discountCodesAdmin.newCode']()}
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center">
		<div class="relative flex-1">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				bind:value={searchQuery}
				oninput={() => (currentPage = 1)}
				placeholder={m['discountCodesAdmin.search.placeholder']()}
				class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label={m['discountCodesAdmin.search.ariaLabel']()}
			/>
		</div>

		<select
			bind:value={activeFilter}
			onchange={() => (currentPage = 1)}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['discountCodesAdmin.filters.statusAria']()}
		>
			<option value="all">{m['discountCodesAdmin.filters.allStatus']()}</option>
			<option value="active">{m['discountCodesAdmin.status.active']()}</option>
			<option value="inactive">{m['discountCodesAdmin.status.inactive']()}</option>
		</select>

		<select
			bind:value={typeFilter}
			onchange={() => (currentPage = 1)}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['discountCodesAdmin.filters.typeAria']()}
		>
			<option value="all">{m['discountCodesAdmin.filters.allTypes']()}</option>
			<option value="percentage">{m['discountCodesAdmin.discountType.percentage']()}</option>
			<option value="fixed_amount">{m['discountCodesAdmin.discountType.fixedAmount']()}</option>
		</select>
	</div>

	<!-- Content -->
	{#if error}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{m['discountCodesAdmin.loadError']()}</AlertDescription>
		</Alert>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['discountCodesAdmin.loadingAria']()}
			></div>
		</div>
	{:else if codes.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
		>
			<Tag class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">{m['discountCodesAdmin.empty.title']()}</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{searchQuery || activeFilter !== 'all' || typeFilter !== 'all'
					? m['discountCodesAdmin.empty.adjustFilters']()
					: m['discountCodesAdmin.empty.getStarted']()}
			</p>
			{#if !searchQuery && activeFilter === 'all' && typeFilter === 'all'}
				<Button
					class="mt-4"
					onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/new`)}
				>
					<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['discountCodesAdmin.newCode']()}
				</Button>
			{/if}
		</div>
	{:else}
		<!-- Table (desktop) / Cards (mobile) -->
		<div class="hidden md:block">
			<div class="overflow-hidden rounded-lg border">
				<table class="w-full text-sm">
					<thead class="bg-muted/50">
						<tr>
							<th class="px-4 py-3 text-left font-medium">{m['discountCodesAdmin.table.code']()}</th
							>
							<th class="px-4 py-3 text-left font-medium"
								>{m['discountCodesAdmin.table.discount']()}</th
							>
							<th class="px-4 py-3 text-left font-medium"
								>{m['discountCodesAdmin.table.status']()}</th
							>
							<th class="px-4 py-3 text-left font-medium"
								>{m['discountCodesAdmin.table.usage']()}</th
							>
							<th class="px-4 py-3 text-left font-medium"
								>{m['discountCodesAdmin.table.validPeriod']()}</th
							>
							<th class="px-4 py-3 text-left font-medium"
								>{m['discountCodesAdmin.table.scope']()}</th
							>
							<th class="px-4 py-3 text-right font-medium"
								>{m['discountCodesAdmin.table.actions']()}</th
							>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each codes as code (code.id)}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<span class="flex items-center gap-1.5">
										<span class="font-mono font-semibold">{code.code}</span>
										<button
											type="button"
											onclick={() => copyCode(code.id, code.code)}
											class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
											aria-label={m['discountCodesAdmin.actions.copyAria']({ code: code.code })}
										>
											{#if copiedCodeId === code.id}
												<Check class="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
											{:else}
												<Copy class="h-3.5 w-3.5" aria-hidden="true" />
											{/if}
										</button>
									</span>
								</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {code.discount_type ===
										'percentage'
											? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
											: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}"
									>
										{formatValue(code)}
									</span>
								</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {code.is_active
											? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
											: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
									>
										{code.is_active
											? m['discountCodesAdmin.status.active']()
											: m['discountCodesAdmin.status.inactive']()}
									</span>
								</td>
								<td class="px-4 py-3 text-muted-foreground">
									{formatUsage(code)}
								</td>
								<td class="px-4 py-3 text-muted-foreground">
									{formatDateRange(code)}
								</td>
								<td class="px-4 py-3 text-muted-foreground">
									{formatScope(code)}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1">
										<button
											type="button"
											onclick={() => handleToggleActive(code)}
											class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
											title={code.is_active
												? m['discountCodesAdmin.actions.deactivate']()
												: m['discountCodesAdmin.actions.activate']()}
											aria-label={code.is_active
												? m['discountCodesAdmin.actions.deactivateAria']()
												: m['discountCodesAdmin.actions.activateAria']()}
										>
											{#if code.is_active}
												<ToggleRight class="h-4 w-4 text-emerald-600" />
											{:else}
												<ToggleLeft class="h-4 w-4" />
											{/if}
										</button>
										<button
											type="button"
											onclick={() =>
												goto(`/org/${organization.slug}/admin/discount-codes/${code.id}/edit`)}
											class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
											title={m['discountCodesAdmin.actions.edit']()}
											aria-label={m['discountCodesAdmin.actions.editAria']()}
										>
											<Pencil class="h-4 w-4" />
										</button>
										<button
											type="button"
											onclick={() => handleDelete(code)}
											class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
											title={willHardDelete(code)
												? m['discountCodesAdmin.delete.titleHardDelete']()
												: m['discountCodesAdmin.delete.titleDeactivate']()}
											aria-label={willHardDelete(code)
												? m['discountCodesAdmin.delete.ariaHardDelete']({ code: code.code })
												: m['discountCodesAdmin.delete.ariaDeactivate']({ code: code.code })}
										>
											{#if willHardDelete(code)}
												<Trash2 class="h-4 w-4" />
											{:else}
												<PowerOff class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile cards -->
		<div class="space-y-3 md:hidden">
			{#each codes as code (code.id)}
				<div class="rounded-lg border p-4">
					<div class="flex items-start justify-between">
						<div>
							<p class="flex items-center gap-2 font-mono text-lg font-semibold">
								{code.code}
								<button
									type="button"
									onclick={() => copyCode(code.id, code.code)}
									class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
									aria-label={m['discountCodesAdmin.actions.copyAria']({ code: code.code })}
								>
									{#if copiedCodeId === code.id}
										<Check class="h-4 w-4 text-emerald-600" aria-hidden="true" />
									{:else}
										<Copy class="h-4 w-4" aria-hidden="true" />
									{/if}
								</button>
							</p>
							<span
								class="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium {code.discount_type ===
								'percentage'
									? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
									: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}"
							>
								{formatValue(code)}
							</span>
						</div>
						<span
							class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {code.is_active
								? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
								: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
						>
							{code.is_active
								? m['discountCodesAdmin.status.active']()
								: m['discountCodesAdmin.status.inactive']()}
						</span>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
						<div>
							<span class="font-medium text-foreground"
								>{m['discountCodesAdmin.card.usage']()}:</span
							>
							{formatUsage(code)}
						</div>
						<div>
							<span class="font-medium text-foreground"
								>{m['discountCodesAdmin.card.scope']()}:</span
							>
							{formatScope(code)}
						</div>
						<div class="col-span-2">
							<span class="font-medium text-foreground"
								>{m['discountCodesAdmin.card.valid']()}:</span
							>
							{formatDateRange(code)}
						</div>
					</div>

					<div class="mt-3 flex gap-2 border-t pt-3">
						<Button
							variant="outline"
							size="sm"
							onclick={() => handleToggleActive(code)}
							class="flex-1"
						>
							{#if code.is_active}
								<ToggleRight class="mr-1 h-4 w-4 text-emerald-600" />
								{m['discountCodesAdmin.actions.deactivate']()}
							{:else}
								<ToggleLeft class="mr-1 h-4 w-4" />
								{m['discountCodesAdmin.actions.activate']()}
							{/if}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/${code.id}/edit`)}
							class="flex-1"
						>
							<Pencil class="mr-1 h-4 w-4" />
							{m['discountCodesAdmin.actions.edit']()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => handleDelete(code)}
							class="text-destructive hover:text-destructive"
							aria-label={willHardDelete(code)
								? m['discountCodesAdmin.delete.ariaHardDelete']({ code: code.code })
								: m['discountCodesAdmin.delete.ariaDeactivate']({ code: code.code })}
						>
							{#if willHardDelete(code)}
								<Trash2 class="h-4 w-4" />
							{:else}
								<PowerOff class="h-4 w-4" />
							{/if}
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between border-t pt-4">
				<p class="text-sm text-muted-foreground">
					{totalCount === 1
						? m['discountCodesAdmin.pagination.totalOne']({ count: totalCount })
						: m['discountCodesAdmin.pagination.total']({ count: totalCount })}
				</p>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage <= 1}
						aria-label={m['discountCodesAdmin.pagination.prevAria']()}
					>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					<span class="text-sm">
						{m['discountCodesAdmin.pagination.page']({ current: currentPage, total: totalPages })}
					</span>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage >= totalPages}
						aria-label={m['discountCodesAdmin.pagination.nextAria']()}
					>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
