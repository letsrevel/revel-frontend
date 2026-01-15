<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { eventadminwaitlistListWaitlist, eventadminwaitlistDeleteWaitlistEntry } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cn } from '$lib/utils/cn';
	import { Users, Trash2, Calendar, Loader2, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(20);

	// Fetch waitlist with pagination
	let waitlistQuery = createQuery(() => ({
		queryKey: ['waitlist', data.eventId, currentPage],
		queryFn: async () => {
			const response = await eventadminwaitlistListWaitlist({
				path: { event_id: data.eventId },
				query: { page: currentPage, page_size: pageSize },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load waitlist');
			}

			return response.data;
		},
		initialData: currentPage === 1 ? data.waitlistData : undefined
	}));

	// Delete mutation
	let deleteMutation = createMutation(() => ({
		mutationFn: async (waitlistId: string) => {
			const response = await eventadminwaitlistDeleteWaitlistEntry({
				path: { event_id: data.eventId, waitlist_id: waitlistId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to remove from waitlist');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['waitlist', data.eventId] });
		}
	}));

	function handleDelete(waitlistId: string, userName: string) {
		if (confirm(m['orgAdmin.waitlist.confirmDelete']({ userName }))) {
			deleteMutation.mutate(waitlistId);
		}
	}

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Pagination controls
	let totalPages = $derived(
		waitlistQuery.data ? Math.ceil(waitlistQuery.data.count / pageSize) : 1
	);
	let canGoPrev = $derived(currentPage > 1);
	let canGoNext = $derived(currentPage < totalPages);

	function goToPrevPage() {
		if (canGoPrev) {
			currentPage--;
		}
	}

	function goToNextPage() {
		if (canGoNext) {
			currentPage++;
		}
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.waitlist.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.waitlist.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.waitlist.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">{m['orgAdmin.waitlist.pageDescription']()}</p>
		</div>
	</div>

	<!-- Loading State -->
	{#if waitlistQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['orgAdmin.waitlist.loading']()}</span>
		</div>
		<!-- Error State -->
	{:else if waitlistQuery.isError}
		<div
			class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
			role="alert"
		>
			<AlertCircle class="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold text-destructive">
				{m['orgAdmin.waitlist.error.title']()}
			</h3>
			<p class="mt-2 text-sm text-destructive/80">
				{m['orgAdmin.waitlist.error.description']()}
			</p>
		</div>
		<!-- Empty State -->
	{:else if waitlistQuery.data && waitlistQuery.data.results.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">{m['orgAdmin.waitlist.empty.title']()}</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{m['orgAdmin.waitlist.empty.description']()}
			</p>
		</div>
		<!-- Waitlist Table -->
	{:else if waitlistQuery.data}
		<div class="space-y-4">
			<!-- Stats -->
			<div class="rounded-lg border bg-card p-4">
				<div class="flex items-center gap-2">
					<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm font-medium">
						{m['orgAdmin.waitlist.totalCount']({
							count: waitlistQuery.data.count,
							plural:
								waitlistQuery.data.count === 1 ? '' : m['orgAdmin.waitlist.totalCount_plural']()
						})}
					</p>
				</div>
			</div>

			<!-- Desktop Table -->
			<div class="hidden overflow-hidden rounded-lg border md:block">
				<table class="w-full border-collapse">
					<thead class="bg-muted/50">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-medium">
								{m['orgAdmin.waitlist.table.user']()}
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium">
								{m['orgAdmin.waitlist.table.email']()}
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium">
								{m['orgAdmin.waitlist.table.joinedAt']()}
							</th>
							<th class="px-4 py-3 text-right text-sm font-medium">
								{m['orgAdmin.waitlist.table.actions']()}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each waitlistQuery.data.results as entry (entry.id)}
							<tr class="transition-colors hover:bg-muted/50">
								<td class="px-4 py-3 text-sm">
									<div class="font-medium">
										{entry.user.first_name}
										{entry.user.last_name}
									</div>
								</td>
								<td class="px-4 py-3 text-sm text-muted-foreground">
									{entry.user.email}
								</td>
								<td class="px-4 py-3 text-sm text-muted-foreground">
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(entry.created_at)}
									</div>
								</td>
								<td class="px-4 py-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										onclick={() =>
											handleDelete(entry.id, `${entry.user.first_name} ${entry.user.last_name}`)}
										disabled={deleteMutation.isPending}
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
									>
										{#if deleteMutation.isPending}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else}
											<Trash2 class="h-4 w-4" aria-hidden="true" />
										{/if}
										<span class="ml-1">{m['orgAdmin.waitlist.actions.remove']()}</span>
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile Cards -->
			<div class="grid gap-4 md:hidden">
				{#each waitlistQuery.data.results as entry (entry.id)}
					<div class="rounded-lg border bg-card p-4">
						<div class="space-y-3">
							<div>
								<div class="font-medium">
									{entry.user.first_name}
									{entry.user.last_name}
								</div>
								<div class="text-sm text-muted-foreground">{entry.user.email}</div>
							</div>

							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Calendar class="h-4 w-4" aria-hidden="true" />
								{formatDate(entry.created_at)}
							</div>

							<div class="border-t pt-3">
								<Button
									variant="destructive"
									size="sm"
									onclick={() =>
										handleDelete(entry.id, `${entry.user.first_name} ${entry.user.last_name}`)}
									disabled={deleteMutation.isPending}
									class="w-full"
								>
									{#if deleteMutation.isPending}
										<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									{:else}
										<Trash2 class="h-4 w-4" aria-hidden="true" />
									{/if}
									<span class="ml-1">{m['orgAdmin.waitlist.actions.remove']()}</span>
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex items-center justify-between border-t pt-4">
					<p class="text-sm text-muted-foreground">
						{m['orgAdmin.waitlist.pagination.info']({
							current: currentPage,
							total: totalPages
						})}
					</p>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={goToPrevPage}
							disabled={!canGoPrev || waitlistQuery.isFetching}
						>
							{m['orgAdmin.waitlist.pagination.previous']()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={goToNextPage}
							disabled={!canGoNext || waitlistQuery.isFetching}
						>
							{m['orgAdmin.waitlist.pagination.next']()}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
