<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { dashboardDashboardOrganizations } from '$lib/api/generated/sdk.gen';
	import { Shield, ChevronDown } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	type BuilderProps = any;

	let accessToken = $derived(authStore.accessToken);
	let permissions = $derived(authStore.permissions);

	// Fetch user's organizations (where they are owner or staff)
	const organizationsQuery = createQuery(() => ({
		queryKey: ['admin-organizations'],
		queryFn: async () => {
			if (!accessToken) return [];

			const response = await dashboardDashboardOrganizations({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				query: {
					page_size: 50,
					// Filter for owner or staff roles
					owner: true,
					staff: true
				}
			});

			return response.data?.results || [];
		},
		enabled: !!accessToken,
		staleTime: 5 * 60 * 1000 // 5 minutes
	}));

	let adminOrganizations = $derived(organizationsQuery.data || []);

	// Helper to check if user has admin permissions for an organization
	function hasAdminPermissions(orgId: string): boolean {
		if (!permissions?.organization_permissions) {
			return false;
		}

		const orgPerms = permissions.organization_permissions[orgId];

		// If user is owner, they have all permissions
		if (orgPerms === 'owner') {
			return true;
		}

		// Check if user has any admin-level permissions (staff role)
		if (typeof orgPerms === 'object' && orgPerms.default) {
			const perms = orgPerms.default;
			return !!(
				perms.edit_organization ||
				perms.manage_members ||
				perms.create_event ||
				perms.manage_event
			);
		}

		return false;
	}

	// Filter organizations to only those where user is admin
	let userAdminOrgs = $derived(adminOrganizations.filter((org) => hasAdminPermissions(org.id)));

	// Handle navigation based on number of admin orgs
	function handleAdminClick() {
		if (userAdminOrgs.length === 0) {
			// No admin orgs - shouldn't happen if button is visible
			return;
		}

		if (userAdminOrgs.length === 1) {
			// Single org - navigate directly
			goto(`/org/${userAdminOrgs[0].slug}/admin`);
		}

		// Multiple orgs - dropdown will handle it
	}

	// Navigate to specific org admin
	function navigateToOrgAdmin(slug: string) {
		goto(`/org/${slug}/admin`);
	}

	// Don't show button if no admin permissions
	let shouldShow = $derived(userAdminOrgs.length > 0);
</script>

{#if shouldShow}
	{#if userAdminOrgs.length === 1}
		<!-- Single org - direct button -->
		<Button variant="ghost" size="sm" class="gap-2 text-sm font-medium" onclick={handleAdminClick}>
			<Shield class="h-4 w-4" />
			Admin
		</Button>
	{:else}
		<!-- Multiple orgs - dropdown -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="sm" class="gap-2 text-sm font-medium">
						<Shield class="h-4 w-4" />
						Admin
						<ChevronDown class="h-4 w-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-56">
				<DropdownMenu.Label>{m['adminButton.selectOrganization']()}</DropdownMenu.Label>
				<DropdownMenu.Separator />
				{#each userAdminOrgs as org}
					<DropdownMenu.Item onclick={() => navigateToOrgAdmin(org.slug)}>
						<div class="flex items-center gap-2">
							<Shield class="h-4 w-4 text-muted-foreground" />
							<span class="flex-1 truncate">{org.name}</span>
						</div>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
{/if}
