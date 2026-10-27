<script lang="ts">
	import { billingNeedsAttention } from '$lib/utils/org-setup-progress';
	import { buildAdminNav, activeNavHref } from '$lib/components/org-admin/admin-nav';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { Menu, ChevronRight, Home } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import AdminSidebar from '$lib/components/org-admin/AdminSidebar.svelte';
	import { canPerformAction } from '$lib/utils/permissions';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	const { data, children }: Props = $props();

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Desktop sidebar state. Seeded once from the cookie the server read; after
	// that the toggle owns it (untrack: we deliberately do not re-sync on reload data).
	let sidebarCollapsed = $state(untrack(() => data.sidebarCollapsed));

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		try {
			document.cookie = `revel_admin_sidebar=${sidebarCollapsed ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
		} catch {
			// Cookies blocked: the toggle still works for this session.
		}
	}

	// Get current path
	const currentPath = $derived($page.url.pathname);

	// Door verification is `check_in_attendees`, which the server load does not
	// pre-extract (it only lifts the two event-authoring flags), so derive it from
	// the permissions payload it already returns. This keeps the door steward's
	// only entry point to the verify page visible.
	const canVerifyMembers = $derived(
		data.isOwner || canPerformAction(data.permissions, data.organization.id, 'check_in_attendees')
	);

	// Shared model for the desktop sidebar and the mobile drawer.
	// Order mirrors the dashboard's former tools index (Dashboard leads: it is
	// this nav's landing page).
	const nav = $derived(
		buildAdminNav({
			orgSlug: data.organization.slug,
			isOwner: data.isOwner,
			canVerifyMembers,
			billingWarning: billingNeedsAttention(data.organization)
		})
	);
	const mobileItemsActiveHref = $derived(activeNavHref(nav, currentPath));
	const role = $derived(data.isOwner ? 'owner' : data.isStaff ? 'staff' : null);

	// Close mobile menu
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	// Toggle mobile menu
	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	// Breadcrumb structure
	const breadcrumbs = $derived([
		{ href: resolve('/(public)', {}), label: m['orgAdmin.breadcrumbs.home']() },
		{
			href: resolve('/(public)/organizations', {}),
			label: m['orgAdmin.breadcrumbs.organizations']()
		},
		{
			href: resolve('/(public)/org/[slug]', { slug: data.organization.slug }),
			label: data.organization.name
		},
		{
			href: resolve('/(auth)/org/[slug]/admin', { slug: data.organization.slug }),
			label: m['orgAdmin.breadcrumbs.admin']()
		}
	]);
</script>

<!--
	Admin Layout. 4rem = the site header above this one (Header.svelte, h-16).

	Structure: on md+ a collapsible left sidebar (AdminSidebar, sticky under the
	site header) sits beside the content column (breadcrumbs + <main>); below md
	a top bar with a hamburger opens a drawer rendering the same grouped nav model.

	Nothing here sticks vertically except the sidebar, which sits below the
	global header and takes no vertical space above the content, so it stays
	pinned while the page scrolls (the old org-name bar + tab strip ate
	a third of a laptop screen in tools like the sector seat editor, reported
	2026-08-13).

	`--admin-sticky-top` stays published as a static navbar-only offset for
	pages that keep their own independent sticky elements (the event editor's
	rail and section scroll-margins, the blacklist/members tab strips).
-->
<div class="min-h-screen bg-background" style="--admin-sticky-top: 4rem">
	<!-- Mobile top bar -->
	<header class="w-full border-b bg-background md:hidden">
		<div class="container mx-auto px-4">
			<div class="flex h-16 items-center justify-between gap-2">
				<div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
					<button
						type="button"
						onclick={toggleMobileMenu}
						class="shrink-0 rounded-md p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={m['orgAdmin.layout.toggleMenu']()}
						aria-expanded={mobileMenuOpen}
					>
						<Menu class="h-5 w-5" />
					</button>

					<!-- Not a heading: this org name is chrome, not page content, every
					     admin page renders its own h1. -->
					<p class="min-w-0 truncate text-base font-extrabold tracking-tight sm:text-xl">
						{data.organization.name}
						<span class="ml-2 text-sm font-normal text-muted-foreground"
							>{m['orgAdmin.layout.adminBadge']()}</span
						>
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					{#if data.isOwner}
						<StatusBadge tone="brand" label={m['orgAdminLayout.ownerBadge']()} size="sm" />
					{:else if data.isStaff}
						<StatusBadge tone="neutral" label={m['orgAdmin.layout.staffBadge']()} size="sm" />
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Mobile Navigation -->
	{#if mobileMenuOpen}
		<div class="md:hidden">
			<nav
				class="border-b bg-background px-4 py-3"
				aria-label={m['orgAdmin.layout.mobileAdminNavigation']()}
			>
				<!-- Breadcrumbs -->
				<div class="mb-4 border-b pb-3">
					<h2 class="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
						{m['orgAdmin.layout.navigationHeading']()}
					</h2>
					<ol class="flex flex-wrap items-center gap-1.5 text-xs">
						{#each breadcrumbs as crumb, i (crumb.href)}
							{#if i > 0}
								<li aria-hidden="true">
									<ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
								</li>
							{/if}
							<li class="flex items-center gap-1.5">
								{#if i === 0}
									<Home class="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
								{/if}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the breadcrumbs array above -->
								<a
									href={crumb.href}
									onclick={closeMobileMenu}
									class="text-muted-foreground/80 transition-colors hover:text-foreground"
									aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
								>
									{crumb.label}
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</li>
						{/each}
					</ol>
				</div>

				<!-- Nav Items (same grouped model as the desktop sidebar) -->
				{#snippet drawerLink(item: (typeof nav)['dashboard'])}
					{@const Icon = item.icon}
					{@const active = item.href === mobileItemsActiveHref}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in buildAdminNav -->
					<a
						href={item.href}
						onclick={closeMobileMenu}
						class="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {active
							? 'bg-primary/10 font-bold text-primary'
							: 'font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'}"
						aria-current={active ? 'page' : undefined}
					>
						<Icon class="h-4 w-4 shrink-0" aria-hidden="true" />
						{item.label}
						{#if item.badge === 'warning'}
							<span
								class="h-2 w-2 rounded-full bg-destructive"
								role="status"
								aria-label={m['common.actionRequired']()}
							></span>
						{/if}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/snippet}
				{@render drawerLink(nav.dashboard)}
				{#each nav.groups as group (group.id)}
					<p
						id="mobile-admin-nav-{group.id}"
						class="px-3 pb-1 pt-4 text-xs font-bold text-muted-foreground"
					>
						{group.label}
					</p>
					<ul class="space-y-1" aria-labelledby="mobile-admin-nav-{group.id}">
						{#each group.items as item (item.id)}
							<li>{@render drawerLink(item)}</li>
						{/each}
					</ul>
				{/each}
			</nav>
		</div>
	{/if}

	<div class="md:flex md:items-start">
		<AdminSidebar
			{nav}
			orgName={data.organization.name}
			{role}
			collapsed={sidebarCollapsed}
			onToggle={toggleSidebar}
			pathname={currentPath}
		/>

		<div class="min-w-0 flex-1">
			<!-- Breadcrumbs (Desktop only) -->
			<nav
				class="hidden px-4 pt-4 md:block"
				aria-label={m['orgAdmin.layout.breadcrumbNavigation']()}
			>
				<ol class="flex items-center gap-1.5 text-xs">
					{#each breadcrumbs as crumb, i (crumb.href)}
						{#if i > 0}
							<li aria-hidden="true">
								<ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
							</li>
						{/if}
						<li class="flex items-center gap-1.5">
							{#if i === 0}
								<Home class="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
							{/if}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the breadcrumbs array above -->
							<a
								href={crumb.href}
								class="text-muted-foreground/80 transition-colors hover:text-foreground"
								aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
							>
								{crumb.label}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ol>
			</nav>

			<!-- Main Content -->
			<main id="main-content" class="container mx-auto py-6">
				{@render children()}
			</main>
		</div>
	</div>
</div>
