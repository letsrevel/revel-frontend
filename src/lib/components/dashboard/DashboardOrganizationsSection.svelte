<script lang="ts">
	import { resolve } from '$app/paths';
	import OrganizationCardSkeleton from '$lib/components/common/OrganizationCardSkeleton.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { getImageUrl } from '$lib/utils/url';
	import { stripMarkdown } from '$lib/seo';
	import { Building2, Sparkles, Shield, Check, Award, Crown } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationRetrieveSchema,
		OrganizationPermissionsSchema
	} from '$lib/api/generated/types.gen';
	import {
		hasAdminPermissions,
		getMembershipStatus,
		getMembershipTier,
		isOwner,
		isStaff,
		statusTones
	} from './dashboard-permissions';

	interface Props {
		organizations: OrganizationRetrieveSchema[];
		isLoading: boolean;
		permissions: OrganizationPermissionsSchema | null;
	}
	let { organizations, isLoading, permissions }: Props = $props();

	const COLLAPSED_COUNT = 3;
	let showAll = $state(false);
	const visibleOrganizations = $derived(
		showAll ? organizations : organizations.slice(0, COLLAPSED_COUNT)
	);
</script>

{#snippet discoverEventsAction()}
	<a
		href={resolve('/(public)/events', {})}
		class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
	>
		<Sparkles class="h-4 w-4" aria-hidden="true" />
		<span>{m['dashboard.sections.discoverEvents']()}</span>
	</a>
{/snippet}

<!-- My Organizations Section -->
<section id="organizations-section" aria-labelledby="organizations-heading">
	<div class="mb-4">
		<SectionHeader
			title={m['dashboard.sections.myOrganizations']()}
			volume="celebration"
			id="organizations-heading"
		/>
	</div>

	{#if isLoading}
		<div class="space-y-3">
			{#each Array(3) as _, i (i)}
				<OrganizationCardSkeleton />
			{/each}
		</div>
	{:else if organizations.length === 0}
		<!-- Empty State -->
		<EmptyState
			icon={Building2}
			title={m['dashboard.emptyStates.noOrganizations']()}
			body={m['dashboard.emptyStates.noOrganizationsHint']()}
			action={discoverEventsAction}
		/>
	{:else}
		<!-- Organization Cards -->
		<div id="dashboard-organizations-list" class="space-y-3">
			{#each visibleOrganizations as org (org.id)}
				{@const descriptionText = org.description ? stripMarkdown(org.description) : ''}
				<div
					class="flex flex-col gap-4 rounded-lg border-2 bg-card p-4 shadow-poster transition-shadow hover:shadow-poster-lg sm:flex-row sm:items-center"
				>
					<div class="flex min-w-0 flex-1 items-center gap-4">
						{#if org.logo}
							<img
								src={getImageUrl(org.logo_thumbnail_url || org.logo)}
								alt=""
								class="h-16 w-16 shrink-0 rounded-full border-2 object-cover"
							/>
						{:else}
							<div
								class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10"
							>
								<Building2 class="h-8 w-8 text-primary" aria-hidden="true" />
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<h3 class="font-bold">{org.name}</h3>
								<!-- Owner Badge -->
								{#if isOwner(permissions, org.id)}
									<StatusBadge
										tone="brand"
										label={m['dashboardPage.ownerBadge']()}
										icon={Crown}
										size="sm"
										srLabel={m['dashboardPage.ownerBadgeLabel']()}
									/>
								{:else if isStaff(permissions, org.id)}
									<!-- Staff Badge -->
									<StatusBadge
										tone="info"
										label={m['dashboardPage.staffBadge']()}
										icon={Shield}
										size="sm"
										srLabel={m['dashboardPage.staffBadgeLabel']()}
									/>
								{/if}
							</div>

							{#if descriptionText}
								<p class="line-clamp-1 text-sm text-muted-foreground">
									{descriptionText}
								</p>
							{/if}

							<!-- Membership Badges -->
							{#if getMembershipStatus(permissions, org.id) || getMembershipTier(permissions, org.id)}
								{@const membershipStatus = getMembershipStatus(permissions, org.id)}
								{@const membershipTier = getMembershipTier(permissions, org.id)}
								<div class="mt-2 flex flex-wrap items-center gap-2">
									<!-- Status Badge -->
									{#if membershipStatus}
										<StatusBadge
											tone={statusTones[membershipStatus]}
											label={m[`memberStatus.${membershipStatus}`]()}
											icon={Check}
											size="sm"
											srLabel={m['dashboardPage.membershipStatusLabel']({
												status: m[`memberStatus.${membershipStatus}`]()
											})}
										/>
									{/if}

									<!-- Tier Badge -->
									{#if membershipTier}
										<StatusBadge
											tone="info"
											label={membershipTier.name}
											icon={Award}
											size="sm"
											srLabel={m['dashboardPage.membershipTierLabel']({
												tier: membershipTier.name
											})}
										/>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<div class="flex shrink-0 gap-2">
						<a
							href={resolve('/(public)/org/[slug]', { slug: org.slug })}
							class="flex-1 rounded-md border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:flex-none"
						>
							{m['dashboard.viewProfile']()}
						</a>
						{#if hasAdminPermissions(permissions, org.id)}
							<a
								href={resolve('/(auth)/org/[slug]/admin', { slug: org.slug })}
								class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-none"
							>
								<Shield class="h-4 w-4" aria-hidden="true" />
								<span>{m['dashboard.adminButton']()}</span>
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		{#if organizations.length > COLLAPSED_COUNT}
			<button
				type="button"
				onclick={() => (showAll = !showAll)}
				aria-expanded={showAll}
				aria-controls="dashboard-organizations-list"
				class="mt-3 w-full rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				{showAll
					? m['dashboard.showFewerOrganizations']()
					: m['dashboard.seeAllOrganizations']({ count: organizations.length })}
			</button>
		{/if}
	{/if}
</section>
