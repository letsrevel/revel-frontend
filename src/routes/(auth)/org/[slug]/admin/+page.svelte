<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { FileText, Megaphone, Plus } from '@lucide/svelte';
	import AnnouncementModal from '$lib/components/announcements/AnnouncementModal.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import { Button } from '$lib/components/ui/button';
	import NextEventPanel from '$lib/components/org-admin-dashboard/NextEventPanel.svelte';
	import AttentionList from '$lib/components/org-admin-dashboard/AttentionList.svelte';
	import UpcomingEventsList from '$lib/components/org-admin-dashboard/UpcomingEventsList.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminmembersListMembershipTiers } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import SetupCard from '$lib/components/org-setup/SetupCard.svelte';
	import {
		billingNeedsAttention,
		buildSetupProgress,
		shouldShowSetupCard
	} from '$lib/utils/org-setup-progress';
	import { buildDashboardModel } from './dashboard-model';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const canCreateEvent = $derived(data.canCreateEvent);

	// Computed once per load: the page is a snapshot, not a ticking clock.
	const model = $derived(buildDashboardModel(data.dashboardEvents, new Date()));

	// Derived from the layout org so the card updates after invalidateAll().
	const setupProgress = $derived(
		data.setupCounts ? buildSetupProgress(organization, data.setupCounts) : null
	);

	// Mirrors the card's collapsed state (bound below) so the page can restore
	// the empty next-event panel when the user hides the card. A writable
	// $derived: it follows the server value across client-side org switches and
	// still takes the card's local hide/show in between.
	let setupCardHidden = $derived(data.setupHidden);
	// The card's "create your first event" box already carries that CTA.
	const setupCardCoversEmptyPanel = $derived(
		setupProgress !== null &&
			shouldShowSetupCard(setupProgress) &&
			!setupCardHidden &&
			setupProgress.event === 'none'
	);

	// State for announcement modal
	let announcementModalOpen = $state(false);

	// Auth token for queries
	const accessToken = $derived(authStore.accessToken);

	// Fetch tiers for announcement modal
	const tiersQuery = createQuery(() => ({
		queryKey: ['membership-tiers', organization?.slug],
		queryFn: async () => {
			if (!organization) throw new Error('Organization not loaded');
			const response = await organizationadminmembersListMembershipTiers({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!accessToken && !!organization?.slug
	}));

	const tiersList = $derived(tiersQuery.data ?? []);

	function createEvent() {
		goto(resolve('/(auth)/org/[slug]/admin/events/new', { slug: organization.slug }));
	}
</script>

<svelte:head>
	<title>{organization.name} Admin Dashboard | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.dashboard.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-8 px-4 md:px-0">
	{#snippet headerActions()}
		<Button variant="outline" onclick={() => (announcementModalOpen = true)}>
			<Megaphone aria-hidden="true" />
			{m['announcements.new']()}
		</Button>
		{#if canCreateEvent}
			<Button onclick={createEvent}>
				<Plus aria-hidden="true" />
				{m['orgAdmin.dashboard.createEventButton']()}
			</Button>
		{/if}
	{/snippet}
	<PageHeader title={m['orgAdmin.nav.dashboard']()} volume="studio" actions={headerActions} />

	{#if setupProgress || data.setupHidden}
		<SetupCard
			orgId={organization.id}
			orgSlug={organization.slug}
			progress={setupProgress}
			visibility={organization.visibility}
			defaultStripeEmail={organization.contact_email ?? ''}
			accessToken={accessToken ?? ''}
			bind:hidden={setupCardHidden}
		/>
	{/if}

	<div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[auto_1fr]">
		{#if !(setupCardCoversEmptyPanel && !model.nextEvent)}
			<NextEventPanel
				event={model.nextEvent}
				isHappeningNow={model.isHappeningNow}
				orgSlug={organization.slug}
				{canCreateEvent}
				onCreateEvent={createEvent}
			/>
		{/if}
		<!-- Side column: spans both left-hand rows on xl so it never inherits the
		     hero's row height (which left a dead gap under a short attention list). -->
		<div class="space-y-8 xl:row-span-2">
			<AttentionList
				pendingRequestCount={data.pendingRequestCount}
				billingNeedsAttention={billingNeedsAttention(organization)}
				draftCount={data.draftCount}
				orgSlug={organization.slug}
				isOwner={data.isOwner}
			/>
		</div>
		<UpcomingEventsList events={model.upcoming} orgSlug={organization.slug} />
	</div>

	<!-- Permissions Notice (for staff members) -->
	{#if data.isStaff && !data.isOwner}
		<div class="rounded-lg border border-info/30 bg-info/10 p-4">
			<div class="flex gap-3">
				<ToneTile tone="info" icon={FileText} size="sm" />
				<div class="flex-1">
					<h3 class="font-bold">
						{m['orgAdmin.dashboard.permissions.staffNoticeTitle']()}
					</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						{m['orgAdmin.dashboard.permissions.staffNoticeDescription']()}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<AnnouncementModal
	open={announcementModalOpen}
	announcement={null}
	organizationSlug={organization.slug}
	tiers={tiersList}
	onClose={() => (announcementModalOpen = false)}
	onSuccess={() => (announcementModalOpen = false)}
/>
