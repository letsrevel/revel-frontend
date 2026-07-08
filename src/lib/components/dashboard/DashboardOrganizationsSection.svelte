<script lang="ts">
	import { resolve } from '$app/paths';
	import OrganizationCardSkeleton from '$lib/components/common/OrganizationCardSkeleton.svelte';
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
		statusStyles
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

<!-- My Organizations Section -->
<section id="organizations-section" aria-labelledby="organizations-heading">
	<div class="mb-4 flex items-center justify-between">
		<h2 id="organizations-heading" class="flex items-center gap-2 text-xl font-semibold">
			<Building2 class="h-5 w-5 text-primary" aria-hidden="true" />
			<span>{m['dashboard.sections.myOrganizations']()}</span>
		</h2>
	</div>

	{#if isLoading}
		<div class="space-y-3">
			{#each Array(3) as _, i (i)}
				<OrganizationCardSkeleton />
			{/each}
		</div>
	{:else if organizations.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-8 text-center">
			<Building2 class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mb-2 text-lg font-semibold">{m['dashboard.emptyStates.noOrganizations']()}</h3>
			<p class="mb-4 text-sm text-muted-foreground">
				{m['dashboard.emptyStates.noOrganizationsHint']()}
			</p>
			<div class="flex flex-wrap justify-center gap-3">
				<a
					href={resolve('/(public)/events', {})}
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					<Sparkles class="h-4 w-4" aria-hidden="true" />
					<span>{m['dashboard.sections.discoverEvents']()}</span>
				</a>
			</div>
		</div>
	{:else}
		<!-- Organization Cards -->
		<div id="dashboard-organizations-list" class="space-y-3">
			{#each visibleOrganizations as org (org.id)}
				{@const descriptionText = org.description ? stripMarkdown(org.description) : ''}
				<div
					class="flex items-center gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
				>
					{#if org.logo}
						<img
							src={getImageUrl(org.logo_thumbnail_url || org.logo)}
							alt=""
							class="h-16 w-16 rounded-full border object-cover"
						/>
					{:else}
						<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
							<Building2 class="h-8 w-8 text-primary" aria-hidden="true" />
						</div>
					{/if}

					<div class="flex-1">
						<div class="flex items-center gap-2">
							<h3 class="font-semibold">{org.name}</h3>
							<!-- Owner Badge -->
							{#if isOwner(permissions, org.id)}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
									aria-label={m['dashboardPage.ownerBadgeLabel']()}
								>
									<Crown class="h-3 w-3" aria-hidden="true" />
									{m['dashboardPage.ownerBadge']()}
								</span>
							{:else if isStaff(permissions, org.id)}
								<!-- Staff Badge -->
								<span
									class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100"
									aria-label={m['dashboardPage.staffBadgeLabel']()}
								>
									<Shield class="h-3 w-3" aria-hidden="true" />
									{m['dashboardPage.staffBadge']()}
								</span>
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
									<span
										class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {statusStyles[
											membershipStatus
										]}"
										aria-label={m['dashboardPage.membershipStatusLabel']({
											status: membershipStatus
										})}
									>
										<Check class="h-3 w-3" aria-hidden="true" />
										{m[`memberStatus.${membershipStatus}`]()}
									</span>
								{/if}

								<!-- Tier Badge -->
								{#if membershipTier}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100"
										aria-label={m['dashboardPage.membershipTierLabel']({
											tier: membershipTier.name
										})}
									>
										<Award class="h-3 w-3" aria-hidden="true" />
										{membershipTier.name}
									</span>
								{/if}
							</div>
						{/if}
					</div>

					<div class="flex gap-2">
						<a
							href={resolve('/(public)/org/[slug]', { slug: org.slug })}
							class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{m['dashboard.viewProfile']()}
						</a>
						{#if hasAdminPermissions(permissions, org.id)}
							<a
								href={resolve('/(auth)/org/[slug]/admin', { slug: org.slug })}
								class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
