<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { Calendar, Repeat, Users, Settings, FileText, Plus } from 'lucide-svelte';
	import { OrganizationDescription } from '$lib/components/organizations';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const canCreateEvent = $derived(data.canCreateEvent);

	// Quick action cards (derived to properly track organization reactivity)
	const quickActions = $derived([
		{
			title: m['orgAdmin.dashboard.quickActions.events.title'](),
			description: m['orgAdmin.dashboard.quickActions.events.description'](),
			icon: Calendar,
			href: `/org/${organization.slug}/admin/events`,
			color: 'text-blue-600 dark:text-blue-400',
			bgColor: 'bg-blue-50 dark:bg-blue-950',
			badge: undefined as string | undefined
		},
		{
			title: m['orgAdmin.dashboard.quickActions.eventSeries.title'](),
			description: m['orgAdmin.dashboard.quickActions.eventSeries.description'](),
			icon: Repeat,
			href: `/org/${organization.slug}/admin/event-series`,
			color: 'text-indigo-600 dark:text-indigo-400',
			bgColor: 'bg-indigo-50 dark:bg-indigo-950',
			badge: undefined as string | undefined
		},
		{
			title: m['orgAdmin.dashboard.quickActions.members.title'](),
			description: m['orgAdmin.dashboard.quickActions.members.description'](),
			icon: Users,
			href: `/org/${organization.slug}/admin/members`,
			color: 'text-green-600 dark:text-green-400',
			bgColor: 'bg-green-50 dark:bg-green-950',
			badge: undefined as string | undefined
		},
		{
			title: m['orgAdmin.dashboard.quickActions.settings.title'](),
			description: m['orgAdmin.dashboard.quickActions.settings.description'](),
			icon: Settings,
			href: `/org/${organization.slug}/admin/settings`,
			color: 'text-purple-600 dark:text-purple-400',
			bgColor: 'bg-purple-50 dark:bg-purple-950',
			badge: undefined as string | undefined
		}
	]);

	function navigateTo(href: string, disabled: boolean = false) {
		if (!disabled) {
			goto(href);
		}
	}

	function createEvent() {
		goto(`/org/${organization.slug}/admin/events/new`);
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

<div class="space-y-6 px-4 md:px-0">
	<!-- Welcome Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
			{m['orgAdmin.dashboard.pageTitle']({ orgName: organization.name })}
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['orgAdmin.dashboard.pageDescription']()}
		</p>
	</div>

	<!-- Quick Actions Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">{m['orgAdmin.dashboard.quickActionsHeading']()}</h2>
			{#if canCreateEvent}
				<button
					type="button"
					onclick={createEvent}
					class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Plus class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.dashboard.createEventButton']()}
				</button>
			{/if}
		</div>

		<!-- Action Cards Grid -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{#each quickActions as action}
				{@const Icon = action.icon}
				{@const isDisabled = !!action.badge}
				<button
					type="button"
					onclick={() => navigateTo(action.href, isDisabled)}
					disabled={isDisabled}
					class="group relative rounded-lg border border-border bg-card p-6 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<!-- Coming Soon Badge -->
					{#if action.badge}
						<span
							class="absolute right-3 top-3 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
						>
							{action.badge}
						</span>
					{/if}

					<!-- Icon -->
					<div class="mb-4 inline-flex rounded-lg {action.bgColor} p-3">
						<Icon class="h-6 w-6 {action.color}" aria-hidden="true" />
					</div>

					<!-- Content -->
					<div class="space-y-1">
						<h3 class="font-semibold">{action.title}</h3>
						<p class="text-sm text-muted-foreground">{action.description}</p>
					</div>

					<!-- Hover Indicator (only for enabled cards) -->
					{#if !isDisabled}
						<div
							class="absolute inset-0 rounded-lg opacity-0 ring-2 ring-primary transition-opacity group-hover:opacity-100"
							aria-hidden="true"
						></div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Organization Info Section -->
	<div class="space-y-4">
		<h2 class="text-lg font-semibold">{m['orgAdmin.dashboard.organizationDetailsHeading']()}</h2>

		<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
			<dl class="grid gap-4 md:grid-cols-2">
				<!-- Organization Name -->
				<div>
					<dt class="text-sm font-medium text-muted-foreground">
						{m['orgAdmin.dashboard.orgDetails.orgName']()}
					</dt>
					<dd class="mt-1 text-base font-semibold">{organization.name}</dd>
				</div>

				<!-- Slug -->
				<div>
					<dt class="text-sm font-medium text-muted-foreground">
						{m['orgAdmin.dashboard.orgDetails.urlSlug']()}
					</dt>
					<dd class="mt-1 font-mono text-sm">{organization.slug}</dd>
				</div>

				<!-- Location -->
				{#if organization.city}
					<div>
						<dt class="text-sm font-medium text-muted-foreground">
							{m['orgAdmin.dashboard.orgDetails.location']()}
						</dt>
						<dd class="mt-1 text-base">
							{organization.city.name}, {organization.city.country}
						</dd>
					</div>
				{/if}

				<!-- Your Role -->
				<div>
					<dt class="text-sm font-medium text-muted-foreground">
						{m['orgAdmin.dashboard.orgDetails.yourRole']()}
					</dt>
					<dd class="mt-1">
						{#if data.isOwner}
							<span
								class="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary"
							>
								{m['orgAdmin.layout.ownerBadge']()}
							</span>
						{:else if data.isStaff}
							<span
								class="inline-flex items-center rounded-md bg-accent px-2 py-1 text-sm font-medium"
							>
								{m['orgAdmin.layout.staffBadge']()}
							</span>
						{/if}
					</dd>
				</div>
			</dl>

			<!-- Description -->
			{#if organization.description}
				<div class="mt-6 border-t pt-4">
					<h3 class="text-sm font-medium text-muted-foreground">
						{m['orgAdmin.dashboard.aboutHeading']({ orgName: organization.name })}
					</h3>
					<div class="mt-2">
						<OrganizationDescription
							description={organization.description}
							organizationName={organization.name}
							showCard={false}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Permissions Notice (for staff members) -->
	{#if data.isStaff && !data.isOwner}
		<div
			class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
		>
			<div class="flex gap-3">
				<FileText class="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
				<div class="flex-1">
					<h3 class="font-medium text-blue-900 dark:text-blue-100">
						{m['orgAdmin.dashboard.permissions.staffNoticeTitle']()}
					</h3>
					<p class="mt-1 text-sm text-blue-700 dark:text-blue-300">
						{m['orgAdmin.dashboard.permissions.staffNoticeDescription']()}
					</p>
				</div>
			</div>
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
