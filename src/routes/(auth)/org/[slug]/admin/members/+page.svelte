<script lang="ts">
	import { membershipTiersKeys } from '$lib/queries/membership-tiers';
	import { standardTiers } from '$lib/utils/membership-tier-kind';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		organizationadminmembersListMembers,
		organizationadminmembersListStaff,
		organizationadminmembersListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import { orgQuestionnairesQueryOptions } from '$lib/queries/org-questionnaires';
	import { isMembersTab } from '$lib/member-register/redirects';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import {
		Users,
		UserCog,
		UserPlus,
		Shield,
		Link,
		CreditCard,
		Receipt,
		Info,
		ChevronDown,
		ScanLine
	} from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import PeopleTab from '$lib/components/members/PeopleTab.svelte';
	import StaffTab from '$lib/components/members/StaffTab.svelte';
	import MembershipRequestsTab from '$lib/components/members/MembershipRequestsTab.svelte';
	import TiersTab from '$lib/components/members/TiersTab.svelte';
	import OrganizationTokensTab from '$lib/components/members/OrganizationTokensTab.svelte';
	import SubscriptionsTab from '$lib/components/members/SubscriptionsTab.svelte';
	import SubscriptionPaymentsTab from '$lib/components/members/SubscriptionPaymentsTab.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// `manage_subscriptions` is a standalone role — a staffer holding only it
	// reaches this page for the Subscriptions tab and must see nothing else
	// (and fire no roster query, which would 403).
	const canManageMembers = $derived(!!data.canManageMembers);
	const canManageSubscriptions = $derived(!!data.canManageSubscriptions);
	const canVerifyMembers = $derived(!!data.canVerifyMembers);

	// Tabs gated on `manage_members`, and the two gated on `manage_subscriptions`
	// (including the org-wide payment ledger, whose controller uses that same
	// permission, NOT the owner-only `manage_organization` behind Financials).
	// The old names (members / requests / tokens) are redirected by the server load.
	const SUBSCRIPTION_TABS = ['subscriptions', 'payments'] as const;

	// Initial-only read (no effect syncing). Permission-validated so a
	// subscriptions-only staffer can't be dropped on a tab that fires 403 queries.
	function initialTab(): string {
		const requested = $page.url.searchParams.get('tab');
		if (
			requested &&
			data.canManageSubscriptions &&
			(SUBSCRIPTION_TABS as readonly string[]).includes(requested)
		) {
			return requested;
		}
		if (
			requested &&
			data.canManageMembers &&
			isMembersTab(requested) &&
			!(SUBSCRIPTION_TABS as readonly string[]).includes(requested)
		) {
			return requested;
		}
		return data.canManageMembers ? 'people' : 'subscriptions';
	}
	let activeTab = $state(initialTab());

	// Create token modal state (shared between the People "Add person" menu and the invite links tab)
	let isCreateTokenModalOpen = $state(false);

	// Fetch members: feeds the per-tier member counts on the Tiers tab
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
		enabled: !!accessToken && canManageMembers
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
		enabled: !!accessToken && canManageMembers
	}));

	// Fetch membership tiers (shared across tabs)
	const tiersQuery = createQuery(() => ({
		queryKey: membershipTiersKeys.all(organization.slug),
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
		enabled: !!accessToken && canManageMembers
	}));

	// Options for the tier-level questionnaire override (value = OrganizationQuestionnaire id).
	// The endpoint has no type filter, so narrow to MEMBERSHIP client-side.
	// Key + fetcher come from the shared factory so the questionnaire admin's
	// mutations invalidate exactly what this reads (#722).
	const questionnairesQuery = createQuery(() =>
		orgQuestionnairesQueryOptions({
			organizationId: organization.id,
			organizationSlug: organization.slug,
			accessToken,
			enabled: canManageMembers
		})
	);

	// Derived data for badge counts and shared state
	const members = $derived(membersQuery.data?.results || []);
	const staff = $derived(staffQuery.data?.results || []);
	const tiers = $derived(tiersQuery.data || []);
	// Pickers (assign/approve/tokens/filter) only take standard tiers; the Tiers
	// tab manages every tier, temporary ones included.
	const pickerTiers = $derived(standardTiers(tiers));
	const membershipQuestionnaires = $derived(
		(questionnairesQuery.data?.results ?? []).filter((q) => q.questionnaire_type === 'membership')
	);

	// Create a Set of staff user IDs for quick lookup (the person sheet's member actions)
	const staffUserIds = $derived(
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
	{#snippet headerActions()}
		{#if canVerifyMembers}
			<!-- Gated on `check_in_attendees`, not `canManageMembers`: an owner or a
			     roster manager without door duty should not be handed a scanner.
			     A steward holding ONLY `check_in_attendees` never reaches this page
			     (the load 403s them) — their way in is the "Verify members" item in the admin sidebar / mobile drawer. -->
			<Button
				href={resolve('/(auth)/org/[slug]/admin/members/verify', { slug: organization.slug })}
				variant="outline"
				class="w-full sm:w-auto"
			>
				<ScanLine class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['orgAdmin.members.verifyCard']()}
			</Button>
		{/if}
	{/snippet}
	<PageHeader
		title={m['orgAdmin.members.pageTitle']()}
		subtitle={m['orgAdmin.members.pageDescription']()}
		actions={headerActions}
	/>

	<!-- What membership grants (discreet inline disclosure, collapsed by default) -->
	<details class="group">
		<summary
			class="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden"
		>
			<Info class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
			<span>{m['orgAdmin.members.grantsInfo.title']()}</span>
			<ChevronDown
				class="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
				aria-hidden="true"
			/>
		</summary>
		<div class="mt-2 space-y-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
			<p>{m['orgAdmin.members.grantsInfo.intro']()}</p>
			<ul class="ml-4 list-disc space-y-1">
				<li>{m['orgAdmin.members.grantsInfo.coOrganizer']()}</li>
				<li>{m['orgAdmin.members.grantsInfo.screening']()}</li>
				<li>{m['orgAdmin.members.grantsInfo.exclusive']()}</li>
				<li>{m['orgAdmin.members.grantsInfo.fees']()}</li>
			</ul>
		</div>
	</details>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<!-- `top` comes from the admin layout as a static navbar-only offset: the
		     org-admin header block above this strip no longer sticks (unstuck
		     2026-08-13), so this only ever needs to clear the global site header. -->
		<div
			class="z-20 -mb-px bg-background pb-3 pt-1 tall:sticky"
			style="top: var(--admin-sticky-top)"
		>
			<TabsList class="grid h-auto w-full grid-cols-3 gap-0.5 sm:grid-cols-7 sm:gap-1">
				{#if canManageMembers}
					<TabsTrigger value="people" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<Users class="h-4 w-4 shrink-0" aria-hidden="true" />
						{m['memberPeople.tab.people']()}
					</TabsTrigger>

					<TabsTrigger value="applications" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<UserPlus class="h-4 w-4 shrink-0" aria-hidden="true" />
						{m['memberPeople.tab.applications']()}
					</TabsTrigger>

					<TabsTrigger value="tiers" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<Shield class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden sm:inline">{m['orgAdmin.members.tabs.tiers']()}</span>
						<span class="sm:hidden">{m['orgAdmin.members.tabs.tiersShort']()}</span>
						{#if tiers.length > 0}
							<span class="hidden text-xs text-muted-foreground lg:inline">({tiers.length})</span>
						{/if}
					</TabsTrigger>
				{/if}

				<!-- Subscriptions stays its own tab right after Tiers: it is gated on a
				     different permission (`manage_subscriptions`), so folding it into the
				     Tiers tab would hide it from billing-only staff. -->
				{#if canManageSubscriptions}
					<TabsTrigger value="subscriptions" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<CreditCard class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden sm:inline">{m['orgAdmin.members.tabs.subscriptions']()}</span>
						<span class="sm:hidden">{m['orgAdmin.members.tabs.subscriptionsShort']()}</span>
					</TabsTrigger>

					<TabsTrigger value="payments" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<Receipt class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden sm:inline">{m['orgAdmin.members.payments.tabLabel']()}</span>
						<span class="sm:hidden">{m['orgAdmin.members.payments.tabLabelShort']()}</span>
					</TabsTrigger>
				{/if}

				{#if canManageMembers}
					<TabsTrigger value="staff" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<UserCog class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden sm:inline">{m['orgAdmin.members.tabs.staff']()}</span>
						<span class="sm:hidden">{m['orgAdmin.members.tabs.staffShort']()}</span>
						{#if staff.length > 0}
							<span class="hidden text-xs text-muted-foreground lg:inline">({staff.length})</span>
						{/if}
					</TabsTrigger>

					<TabsTrigger value="invite-links" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
						<Link class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden sm:inline">{m['memberPeople.tab.inviteLinks']()}</span>
						<span class="sm:hidden">{m['orgAdmin.members.tabs.tokensShort']()}</span>
					</TabsTrigger>
				{/if}
			</TabsList>
		</div>

		{#if canManageMembers}
			<TabsContent value="people" class="space-y-4">
				<PeopleTab
					{organization}
					active={activeTab === 'people'}
					isOwner={!!data.isOwner}
					onOpenApplications={() => (activeTab = 'applications')}
					onCreateInviteLink={() => {
						isCreateTokenModalOpen = true;
						activeTab = 'invite-links';
					}}
					{staffUserIds}
					onOpenTiers={() => (activeTab = 'tiers')}
					onOpenPayments={canManageSubscriptions ? () => (activeTab = 'payments') : undefined}
				/>
			</TabsContent>

			<TabsContent value="applications" class="space-y-4">
				<MembershipRequestsTab {organization} tiers={pickerTiers} />
			</TabsContent>

			<TabsContent value="tiers" class="space-y-4">
				<TiersTab
					{organization}
					{tiers}
					{members}
					isLoading={tiersQuery.isLoading}
					isError={tiersQuery.isError}
					canManageSubscriptions={data.canManageSubscriptions}
					{membershipQuestionnaires}
					orgDefaultRequiresApproval={!!organization.default_requires_membership_approval}
				/>
			</TabsContent>
		{/if}

		{#if canManageSubscriptions}
			<TabsContent value="subscriptions" class="space-y-4">
				<SubscriptionsTab {organization} />
			</TabsContent>

			<!-- Org-wide membership payment ledger (reconciliation surface) -->
			<TabsContent value="payments" class="space-y-4">
				<SubscriptionPaymentsTab {organization} />
			</TabsContent>
		{/if}

		{#if canManageMembers}
			<TabsContent value="staff" class="space-y-4">
				<StaffTab {organization} isOwner={!!data.isOwner} />
			</TabsContent>

			<TabsContent value="invite-links" class="space-y-4">
				<OrganizationTokensTab
					{organization}
					isOwner={!!data.isOwner}
					tiers={pickerTiers}
					isCreateModalOpen={isCreateTokenModalOpen}
					onCreateModalOpenChange={(open) => (isCreateTokenModalOpen = open)}
				/>
			</TabsContent>
		{/if}
	</Tabs>
</div>
