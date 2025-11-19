<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationRetrieveSchema,
		MembershipTierSchema,
		MembershipStatus
	} from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { getBackendUrl } from '$lib/config/api';
	import RequestMembershipButton from '$lib/components/organization/RequestMembershipButton.svelte';

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

	let {
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

	// Compute full logo URL
	const logoUrl = $derived(getImageUrl(organization.logo));
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
				{#if organization.description_html}
					<div
						class="prose prose-sm dark:prose-invert mt-1 line-clamp-3 text-sm text-muted-foreground"
					>
						{@html organization.description_html}
					</div>
				{:else if organization.description}
					<p class="mt-1 line-clamp-3 text-sm text-muted-foreground">
						{organization.description}
					</p>
				{/if}
			</div>
		</div>

		<!-- Action Links -->
		<div class="mt-6 flex flex-wrap gap-2">
			<a
				href="/org/{organization.slug}"
				class="inline-flex rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				View organization profile
			</a>

			<!-- Request Membership Button (if org accepts members and user is not a member) -->
			{#if organization.accept_membership_requests}
				<RequestMembershipButton
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
			{/if}
		</div>
	</div>
</section>
