<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationRetrieveSchema,
		MembershipTierSchema,
		MembershipStatus
	} from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { getBackendUrl } from '$lib/config/api';
	import MembershipCta from '$lib/components/organization/membership/MembershipCta.svelte';
	import { Button } from '$lib/components/ui/button';
	import OrgContactButton from '$lib/components/organization/OrgContactButton.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import FollowButton from '$lib/components/common/FollowButton.svelte';

	interface Props {
		organization: OrganizationRetrieveSchema;
		isAuthenticated: boolean;
		isMember: boolean;
		membershipTier?: MembershipTierSchema | null;
		membershipStatus?: MembershipStatus | null;
		isOwner?: boolean;
		isStaff?: boolean;
		class?: string;
	}

	const {
		organization,
		isAuthenticated,
		isMember,
		membershipTier = null,
		membershipStatus = null,
		isOwner = false,
		isStaff = false,
		class: className
	}: Props = $props();

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		return getBackendUrl(path);
	}

	// Compute full logo URL - prefer thumbnail for small display sizes
	const logoUrl = $derived(getImageUrl(organization.logo_thumbnail_url || organization.logo));

	// The tiers have their own page since #720 — a real route, so no fragment to
	// append and nothing for resolve() to be worked around.
	const membershipHref = $derived(
		resolve('/(public)/org/[slug]/membership', { slug: organization.slug })
	);
</script>

<section aria-labelledby="organizer-heading" class={cn('space-y-4', className)}>
	<h2 id="organizer-heading" class="text-xl font-semibold">
		{m['organizationInfo.aboutOrganizer']()}
	</h2>

	<div class="rounded-lg border bg-card p-6">
		<!-- Organization Header -->
		<div class="flex items-start gap-4">
			{#if logoUrl}
				<img
					src={logoUrl}
					alt="{organization.name} logo"
					class="h-16 w-16 rounded-lg object-cover"
				/>
			{:else}
				<div
					class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground"
				>
					{organization.name.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="flex-1">
				<h3 class="text-lg font-semibold">{organization.name}</h3>
				{#if organization.description}
					<MarkdownContent
						content={organization.description}
						class="mt-1 line-clamp-3 text-sm text-muted-foreground"
					/>
				{/if}
			</div>
		</div>

		<!-- Action Links -->
		<div class="mt-6 flex flex-wrap gap-2">
			<a
				href={resolve('/(public)/org/[slug]', { slug: organization.slug })}
				class="inline-flex rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['organizationInfo.viewProfile']()}
			</a>

			<!-- Standing with the org, or a pointer at where to join it. The badge
			     branches come from MembershipCta (which owns the ported badges);
			     joining itself lives on the org page, so this side only links to
			     it — no eligibility round trip per event page. -->
			{#if isOwner || isStaff || isMember}
				<MembershipCta
					organizationSlug={organization.slug}
					organizationName={organization.name}
					{isAuthenticated}
					{isMember}
					{membershipTier}
					{membershipStatus}
					{isOwner}
					{isStaff}
					class="inline-flex"
				/>
			{:else if organization.accept_membership_requests}
				<Button href={membershipHref} variant="outline">
					{m['membershipPlans.viewMembership']()}
				</Button>
			{/if}

			<!-- Follow Button -->
			<FollowButton
				entityType="organization"
				entityId={organization.slug}
				entityName={organization.name}
				{isAuthenticated}
				variant="outline"
			/>

			<!-- Contact Organizer Button -->
			{#if organization.contact_method && organization.contact_method !== 'none'}
				<OrgContactButton
					organizationSlug={organization.slug}
					organizationName={organization.name}
					contactMethod={organization.contact_method}
					contactEmail={organization.contact_email}
					{isAuthenticated}
					variant="outline"
				/>
			{/if}
		</div>
	</div>
</section>
