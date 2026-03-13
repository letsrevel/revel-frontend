<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		organizationadminmembersListMembers,
		organizationadminmembersListStaff,
		organizationadminmembersListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Users, UserCog, UserPlus, Shield, Link, Plus } from 'lucide-svelte';
	import MembersTab from '$lib/components/members/MembersTab.svelte';
	import StaffTab from '$lib/components/members/StaffTab.svelte';
	import MembershipRequestsTab from '$lib/components/members/MembershipRequestsTab.svelte';
	import TiersTab from '$lib/components/members/TiersTab.svelte';
	import OrganizationTokensTab from '$lib/components/members/OrganizationTokensTab.svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// Active tab state
	let activeTab = $state('members');

	// Create token modal state (shared between header button and tokens tab)
	let isCreateTokenModalOpen = $state(false);

	// Fetch members (for tab badge counts and cross-tab data)
	const membersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'members', '', 'all', 'all'],
		queryFn: async () => {
			const response = await organizationadminmembersListMembers({
				path: { slug: organization.slug },
				query: { page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch members');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch staff (for tab badge counts and cross-tab data)
	const staffQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'staff', ''],
		queryFn: async () => {
			const response = await organizationadminmembersListStaff({
				path: { slug: organization.slug },
				query: { page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch staff');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch membership tiers (shared across tabs)
	const tiersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'membership-tiers'],
		queryFn: async () => {
			const response = await organizationadminmembersListMembershipTiers({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch membership tiers');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Derived data for badge counts and shared state
	let members = $derived(membersQuery.data?.results || []);
	let staff = $derived(staffQuery.data?.results || []);
	let tiers = $derived(tiersQuery.data || []);

	// Create a Set of staff user IDs for quick lookup (used by MembersTab)
	let staffUserIds = $derived(
		new Set(staff.map((s) => s.user.id).filter((id): id is string => !!id))
	);
</script>

<svelte:head>
	<title>{m['orgAdmin.members.pageTitle']()} - {organization.name} | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.members.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.members.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.members.pageDescription']()}
			</p>
		</div>
		<Button
			onclick={() => {
				isCreateTokenModalOpen = true;
				activeTab = 'tokens';
			}}
			class="w-full sm:w-auto"
		>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			Invite members
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<div class="sticky top-32 z-20 -mb-px bg-background pb-3 pt-1">
			<TabsList class="h-auto w-full grid-cols-3 gap-0.5 sm:grid-cols-5 sm:gap-1">
				<TabsTrigger value="members" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Users class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.members']()}</span>
					<span class="sm:hidden">Members</span>
					{#if members.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({members.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="staff" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<UserCog class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.staff']()}</span>
					<span class="sm:hidden">Staff</span>
					{#if staff.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({staff.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="requests" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<UserPlus class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.requests']()}</span>
					<span class="sm:hidden">Requests</span>
				</TabsTrigger>

				<TabsTrigger value="tiers" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Shield class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.tiers']()}</span>
					<span class="sm:hidden">Tiers</span>
					{#if tiers.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({tiers.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="tokens" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Link class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">Invite Links</span>
					<span class="sm:hidden">Links</span>
				</TabsTrigger>
			</TabsList>
		</div>

		<!-- Members Tab -->
		<TabsContent value="members" class="space-y-4">
			<MembersTab
				{organization}
				isOwner={!!data.isOwner}
				permissions={data.permissions}
				{tiers}
				{staffUserIds}
			/>
		</TabsContent>

		<!-- Staff Tab -->
		<TabsContent value="staff" class="space-y-4">
			<StaffTab {organization} isOwner={!!data.isOwner} />
		</TabsContent>

		<!-- Requests Tab -->
		<TabsContent value="requests" class="space-y-4">
			<MembershipRequestsTab {organization} {tiers} />
		</TabsContent>

		<!-- Tiers Tab -->
		<TabsContent value="tiers" class="space-y-4">
			<TiersTab
				{organization}
				{tiers}
				{members}
				isLoading={tiersQuery.isLoading}
				isError={tiersQuery.isError}
			/>
		</TabsContent>

		<!-- Tokens Tab -->
		<TabsContent value="tokens" class="space-y-4">
			<OrganizationTokensTab
				{organization}
				isOwner={!!data.isOwner}
				{tiers}
				isCreateModalOpen={isCreateTokenModalOpen}
				onCreateModalOpenChange={(open) => (isCreateTokenModalOpen = open)}
			/>
		</TabsContent>
	</Tabs>
</div>
