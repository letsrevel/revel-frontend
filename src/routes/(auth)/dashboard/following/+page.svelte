<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		followingListFollowedOrganizations,
		followingListFollowedEventSeries,
		organizationUnfollowOrganization,
		organizationUpdateOrganizationFollow,
		eventseriesUnfollowEventSeries,
		eventseriesUpdateEventSeriesFollow
	} from '$lib/api/generated/sdk.gen';
	import { Heart, Building2, Calendar, Loader2, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getImageUrl } from '$lib/utils/url';

	let accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Tab state
	type TabType = 'organizations' | 'event-series';
	let activeTab = $state<TabType>('organizations');

	// Pagination
	let currentPage = $derived(Number(page.url.searchParams.get('page') || '1'));
	const pageSize = 12;

	// Fetch followed organizations
	const orgsQuery = createQuery(() => ({
		queryKey: ['followed-organizations', currentPage] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await followingListFollowedOrganizations({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					page: currentPage,
					page_size: pageSize
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken && activeTab === 'organizations'
	}));

	// Fetch followed event series
	const seriesQuery = createQuery(() => ({
		queryKey: ['followed-event-series', currentPage] as const,
		queryFn: async () => {
			if (!accessToken) return { results: [], count: 0 };

			const response = await followingListFollowedEventSeries({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					page: currentPage,
					page_size: pageSize
				}
			});

			return response.data || { results: [], count: 0 };
		},
		enabled: !!accessToken && activeTab === 'event-series'
	}));

	let organizations = $derived(orgsQuery.data?.results || []);
	let orgsCount = $derived(orgsQuery.data?.count || 0);
	let orgsTotalPages = $derived(Math.ceil(orgsCount / pageSize));

	let eventSeries = $derived(seriesQuery.data?.results || []);
	let seriesCount = $derived(seriesQuery.data?.count || 0);
	let seriesTotalPages = $derived(Math.ceil(seriesCount / pageSize));

	// Navigate to page
	function navigateToPage(pageNum: number) {
		const url = new URL(page.url);
		if (pageNum === 1) {
			url.searchParams.delete('page');
		} else {
			url.searchParams.set('page', pageNum.toString());
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Switch tab
	function switchTab(tab: TabType) {
		activeTab = tab;
		navigateToPage(1);
	}

	// Unfollow organization mutation
	const unfollowOrgMutation = createMutation(() => ({
		mutationFn: async (slug: string) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationUnfollowOrganization({
				path: { slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to unfollow');
			return slug;
		},
		onSuccess: (slug) => {
			queryClient.invalidateQueries({ queryKey: ['followed-organizations'] });
			const org = organizations.find((o) => o.organization.slug === slug);
			toast.success(
				m['follow.unfollowSuccess']({ name: org?.organization.name || 'Organization' })
			);
		},
		onError: () => {
			toast.error(m['follow.unfollowError']());
		}
	}));

	// Update organization preferences mutation
	const updateOrgMutation = createMutation(() => ({
		mutationFn: async ({
			slug,
			prefs
		}: {
			slug: string;
			prefs: { notify_new_events?: boolean; notify_announcements?: boolean };
		}) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationUpdateOrganizationFollow({
				path: { slug },
				body: prefs,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to update');
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['followed-organizations'] });
			toast.success(m['follow.preferencesUpdated']());
		},
		onError: () => {
			toast.error(m['follow.updateError']());
		}
	}));

	// Unfollow event series mutation
	const unfollowSeriesMutation = createMutation(() => ({
		mutationFn: async (seriesId: string) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesUnfollowEventSeries({
				path: { series_id: seriesId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to unfollow');
			return seriesId;
		},
		onSuccess: (seriesId) => {
			queryClient.invalidateQueries({ queryKey: ['followed-event-series'] });
			const series = eventSeries.find((s) => s.event_series.id === seriesId);
			toast.success(m['follow.unfollowSuccess']({ name: series?.event_series.name || 'Series' }));
		},
		onError: () => {
			toast.error(m['follow.unfollowError']());
		}
	}));

	// Update event series preferences mutation
	const updateSeriesMutation = createMutation(() => ({
		mutationFn: async ({
			seriesId,
			prefs
		}: {
			seriesId: string;
			prefs: { notify_new_events?: boolean };
		}) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesUpdateEventSeriesFollow({
				path: { series_id: seriesId },
				body: prefs,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to update');
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['followed-event-series'] });
			toast.success(m['follow.preferencesUpdated']());
		},
		onError: () => {
			toast.error(m['follow.updateError']());
		}
	}));
</script>

<svelte:head>
	<title>{m['dashboard.following.title']()} - Revel</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<Heart class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div>
				<h1 class="text-2xl font-bold md:text-3xl">{m['dashboard.following.title']()}</h1>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-6">
		<div class="border-b border-border">
			<nav class="-mb-px flex gap-6" aria-label="Following tabs">
				<button
					type="button"
					onclick={() => switchTab('organizations')}
					class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
					'organizations'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
					aria-current={activeTab === 'organizations' ? 'page' : undefined}
				>
					<Building2 class="h-4 w-4" aria-hidden="true" />
					{m['dashboard.following.organizations']()}
					{#if orgsCount > 0}
						<span
							class="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
						>
							{orgsCount}
						</span>
					{/if}
				</button>

				<button
					type="button"
					onclick={() => switchTab('event-series')}
					class="inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
					'event-series'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
					aria-current={activeTab === 'event-series' ? 'page' : undefined}
				>
					<Calendar class="h-4 w-4" aria-hidden="true" />
					{m['dashboard.following.eventSeries']()}
					{#if seriesCount > 0}
						<span
							class="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
						>
							{seriesCount}
						</span>
					{/if}
				</button>
			</nav>
		</div>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'organizations'}
		<!-- Organizations Tab -->
		<div class="space-y-6">
			{#if orgsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
				</div>
			{:else if organizations.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Building2 class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">{m['dashboard.following.noOrganizations']()}</h3>
					<Button href="/organizations" variant="default" class="mt-4">
						{m['dashboard.following.discoverOrganizations']()}
					</Button>
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each organizations as follow (follow.id)}
						{@const org = follow.organization}
						<div class="rounded-lg border bg-card p-4">
							<div class="mb-3 flex items-start gap-3">
								{#if org.logo}
									<img
										src={getImageUrl((org as any).logo_thumbnail_url || org.logo)}
										alt={org.name}
										class="h-12 w-12 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
									>
										{org.name.charAt(0).toUpperCase()}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<a
										href="/org/{org.slug}"
										class="block truncate font-semibold hover:text-primary hover:underline"
									>
										{org.name}
									</a>
								</div>
							</div>

							<!-- Notification Preferences -->
							<div class="space-y-2 border-t pt-3">
								<label class="flex cursor-pointer items-center justify-between gap-2 text-sm">
									<span class="flex-1">{m['follow.notifyNewEvents']()}</span>
									<Checkbox
										checked={follow.notify_new_events}
										onCheckedChange={(checked: boolean | 'indeterminate') => {
											if (typeof checked === 'boolean') {
												updateOrgMutation.mutate({
													slug: org.slug,
													prefs: { notify_new_events: checked }
												});
											}
										}}
										disabled={updateOrgMutation.isPending}
										aria-label={m['follow.notifyNewEvents']()}
									/>
								</label>
								<label class="flex cursor-pointer items-center justify-between gap-2 text-sm">
									<span class="flex-1">{m['follow.notifyAnnouncements']()}</span>
									<Checkbox
										checked={follow.notify_announcements}
										onCheckedChange={(checked: boolean | 'indeterminate') => {
											if (typeof checked === 'boolean') {
												updateOrgMutation.mutate({
													slug: org.slug,
													prefs: { notify_announcements: checked }
												});
											}
										}}
										disabled={updateOrgMutation.isPending}
										aria-label={m['follow.notifyAnnouncements']()}
									/>
								</label>
							</div>

							<!-- Unfollow Button -->
							<div class="mt-3 border-t pt-3">
								<Button
									variant="ghost"
									size="sm"
									class="w-full text-destructive hover:text-destructive"
									onclick={() => unfollowOrgMutation.mutate(org.slug)}
									disabled={unfollowOrgMutation.isPending}
								>
									{m['follow.unfollow']()}
								</Button>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if orgsTotalPages > 1}
					<div class="flex items-center justify-between border-t pt-4">
						<p class="text-sm text-muted-foreground">
							{m['dashboard.following.showing']({
								count: organizations.length,
								total: orgsCount
							})}
						</p>
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => navigateToPage(currentPage - 1)}
								disabled={currentPage === 1}
								aria-label={m['dashboard.following.previousPage']()}
							>
								<ChevronLeft class="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => navigateToPage(currentPage + 1)}
								disabled={currentPage >= orgsTotalPages}
								aria-label={m['dashboard.following.nextPage']()}
							>
								<ChevronRight class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<!-- Event Series Tab -->
		<div class="space-y-6">
			{#if seriesQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
				</div>
			{:else if eventSeries.length === 0}
				<div class="rounded-lg border bg-card p-12 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Calendar class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">{m['dashboard.following.noEventSeries']()}</h3>
					<Button href="/events" variant="default" class="mt-4">
						{m['dashboard.following.discoverEventSeries']()}
					</Button>
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each eventSeries as follow (follow.id)}
						{@const series = follow.event_series}
						<div class="rounded-lg border bg-card p-4">
							<div class="mb-3 flex items-start gap-3">
								{#if series.logo}
									<img
										src={getImageUrl((series as any).logo_thumbnail_url || series.logo)}
										alt={series.name}
										class="h-12 w-12 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
									>
										{series.name.charAt(0).toUpperCase()}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<a
										href="/events/{series.organization.slug}/series/{series.slug}"
										class="block truncate font-semibold hover:text-primary hover:underline"
									>
										{series.name}
									</a>
									<a
										href="/org/{series.organization.slug}"
										class="truncate text-sm text-muted-foreground hover:underline"
									>
										{series.organization.name}
									</a>
								</div>
							</div>

							<!-- Notification Preferences -->
							<div class="space-y-2 border-t pt-3">
								<label class="flex cursor-pointer items-center justify-between gap-2 text-sm">
									<span class="flex-1">{m['follow.notifyNewEvents']()}</span>
									<Checkbox
										checked={follow.notify_new_events}
										onCheckedChange={(checked: boolean | 'indeterminate') => {
											if (typeof checked === 'boolean') {
												updateSeriesMutation.mutate({
													seriesId: series.id,
													prefs: { notify_new_events: checked }
												});
											}
										}}
										disabled={updateSeriesMutation.isPending}
										aria-label={m['follow.notifyNewEvents']()}
									/>
								</label>
							</div>

							<!-- Unfollow Button -->
							<div class="mt-3 border-t pt-3">
								<Button
									variant="ghost"
									size="sm"
									class="w-full text-destructive hover:text-destructive"
									onclick={() => unfollowSeriesMutation.mutate(series.id)}
									disabled={unfollowSeriesMutation.isPending}
								>
									{m['follow.unfollow']()}
								</Button>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if seriesTotalPages > 1}
					<div class="flex items-center justify-between border-t pt-4">
						<p class="text-sm text-muted-foreground">
							{m['dashboard.following.showing']({
								count: eventSeries.length,
								total: seriesCount
							})}
						</p>
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => navigateToPage(currentPage - 1)}
								disabled={currentPage === 1}
								aria-label={m['dashboard.following.previousPage']()}
							>
								<ChevronLeft class="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => navigateToPage(currentPage + 1)}
								disabled={currentPage >= seriesTotalPages}
								aria-label={m['dashboard.following.nextPage']()}
							>
								<ChevronRight class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
