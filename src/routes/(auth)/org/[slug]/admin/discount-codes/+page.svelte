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
		ToggleLeft,
		ToggleRight,
		ChevronLeft,
		ChevronRight,
		AlertCircle
	} from 'lucide-svelte';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

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

	// Delete mutation
	const deleteMutation = createMutation(() => ({
		mutationFn: async (codeId: string) => {
			const response = await organizationadmindiscountcodesDeleteDiscountCode({
				path: { slug: organization.slug, code_id: codeId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to delete discount code');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
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

	function handleDelete(code: DiscountCodeSchema) {
		if (confirm(`Deactivate discount code "${code.code}"? This will soft-delete it.`)) {
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
			parts.push(`${code.series_ids.length} series`);
		}
		if (code.event_ids && code.event_ids.length > 0) {
			parts.push(`${code.event_ids.length} event${code.event_ids.length > 1 ? 's' : ''}`);
		}
		if (code.tier_ids && code.tier_ids.length > 0) {
			parts.push(`${code.tier_ids.length} tier${code.tier_ids.length > 1 ? 's' : ''}`);
		}
		return parts.length > 0 ? parts.join(', ') : 'Org-wide';
	}

	function formatDateRange(code: DiscountCodeSchema): string {
		if (!code.valid_from && !code.valid_until) return 'Always';
		const from = code.valid_from
			? new Date(code.valid_from).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			: 'Now';
		const until = code.valid_until
			? new Date(code.valid_until).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			: 'No expiry';
		return `${from} → ${until}`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Discount Codes</h1>
			<p class="text-muted-foreground">Create and manage discount codes for ticket checkout.</p>
		</div>

		<Button onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/new`)}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			New Discount Code
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
				placeholder="Search by code..."
				class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Search discount codes"
			/>
		</div>

		<select
			bind:value={activeFilter}
			onchange={() => (currentPage = 1)}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Filter by status"
		>
			<option value="all">All Status</option>
			<option value="active">Active</option>
			<option value="inactive">Inactive</option>
		</select>

		<select
			bind:value={typeFilter}
			onchange={() => (currentPage = 1)}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Filter by type"
		>
			<option value="all">All Types</option>
			<option value="percentage">Percentage</option>
			<option value="fixed_amount">Fixed Amount</option>
		</select>
	</div>

	<!-- Content -->
	{#if error}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>Failed to load discount codes. Please try again.</AlertDescription>
		</Alert>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label="Loading discount codes"
			></div>
		</div>
	{:else if codes.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
		>
			<Tag class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">No discount codes found</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{searchQuery || activeFilter !== 'all' || typeFilter !== 'all'
					? 'Try adjusting your filters'
					: 'Get started by creating your first discount code'}
			</p>
			{#if !searchQuery && activeFilter === 'all' && typeFilter === 'all'}
				<Button
					class="mt-4"
					onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/new`)}
				>
					<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
					New Discount Code
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
							<th class="px-4 py-3 text-left font-medium">Code</th>
							<th class="px-4 py-3 text-left font-medium">Discount</th>
							<th class="px-4 py-3 text-left font-medium">Status</th>
							<th class="px-4 py-3 text-left font-medium">Usage</th>
							<th class="px-4 py-3 text-left font-medium">Valid Period</th>
							<th class="px-4 py-3 text-left font-medium">Scope</th>
							<th class="px-4 py-3 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each codes as code (code.id)}
							<tr class="hover:bg-muted/30">
								<td class="px-4 py-3">
									<span class="font-mono font-semibold">{code.code}</span>
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
										{code.is_active ? 'Active' : 'Inactive'}
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
											title={code.is_active ? 'Deactivate' : 'Activate'}
											aria-label={code.is_active ? 'Deactivate code' : 'Activate code'}
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
											title="Edit"
											aria-label="Edit discount code"
										>
											<Pencil class="h-4 w-4" />
										</button>
										<button
											type="button"
											onclick={() => handleDelete(code)}
											class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
											title="Delete"
											aria-label="Delete discount code"
										>
											<Trash2 class="h-4 w-4" />
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
							<p class="font-mono text-lg font-semibold">{code.code}</p>
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
							{code.is_active ? 'Active' : 'Inactive'}
						</span>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
						<div>
							<span class="font-medium text-foreground">Usage:</span>
							{formatUsage(code)}
						</div>
						<div>
							<span class="font-medium text-foreground">Scope:</span>
							{formatScope(code)}
						</div>
						<div class="col-span-2">
							<span class="font-medium text-foreground">Valid:</span>
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
								Deactivate
							{:else}
								<ToggleLeft class="mr-1 h-4 w-4" />
								Activate
							{/if}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => goto(`/org/${organization.slug}/admin/discount-codes/${code.id}/edit`)}
							class="flex-1"
						>
							<Pencil class="mr-1 h-4 w-4" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => handleDelete(code)}
							class="text-destructive hover:text-destructive"
							aria-label="Delete discount code {code.code}"
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between border-t pt-4">
				<p class="text-sm text-muted-foreground">
					{totalCount} code{totalCount === 1 ? '' : 's'} total
				</p>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage <= 1}
						aria-label="Previous page"
					>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					<span class="text-sm">
						Page {currentPage} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage >= totalPages}
						aria-label="Next page"
					>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
