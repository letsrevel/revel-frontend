<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { Menu, ChevronRight, Home } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Get current path
	let currentPath = $derived($page.url.pathname);

	// Admin navigation items
	const navItems = [
		{ href: `/org/${data.organization.slug}/admin`, label: m['orgAdmin.nav.dashboard']() },
		{ href: `/org/${data.organization.slug}/admin/events`, label: m['orgAdmin.nav.events']() },
		{
			href: `/org/${data.organization.slug}/admin/event-series`,
			label: m['orgAdmin.nav.eventSeries']()
		},
		{
			href: `/org/${data.organization.slug}/admin/members`,
			label: m['orgAdmin.nav.members'](),
			subItems: data.organization.accept_membership_requests
				? [
						{
							href: `/org/${data.organization.slug}/admin/members/requests`,
							label: m['orgAdmin.nav.memberRequests']()
						}
					]
				: undefined
		},
		{
			href: `/org/${data.organization.slug}/admin/questionnaires`,
			label: m['orgAdmin.nav.questionnaires']()
		},
		{
			href: `/org/${data.organization.slug}/admin/resources`,
			label: m['orgAdmin.nav.resources']()
		},
		{
			href: `/org/${data.organization.slug}/admin/tokens`,
			label: m['orgAdmin.nav.invitationLinks']()
		},
		{ href: `/org/${data.organization.slug}/admin/settings`, label: m['orgAdmin.nav.settings']() }
	];

	// Check if link is active
	function isActive(href: string): boolean {
		// For the dashboard (admin root), only match exact path
		if (href.endsWith('/admin')) {
			return currentPath === href;
		}
		// For other paths, match exact or starting with path + '/'
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Close mobile menu
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	// Toggle mobile menu
	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	// Breadcrumb structure
	let breadcrumbs = $derived([
		{ href: '/', label: m['orgAdmin.breadcrumbs.home']() },
		{ href: '/organizations', label: m['orgAdmin.breadcrumbs.organizations']() },
		{ href: `/org/${data.organization.slug}`, label: data.organization.name },
		{ href: `/org/${data.organization.slug}/admin`, label: m['orgAdmin.breadcrumbs.admin']() }
	]);
</script>

<!-- Admin Layout -->
<div class="min-h-screen bg-background">
	<!-- Admin Header -->
	<header
		class="sticky top-16 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="container mx-auto px-4">
			<!-- Top Bar -->
			<div class="flex h-16 items-center justify-between">
				<!-- Left: Org Name & Admin Badge -->
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={toggleMobileMenu}
						class="rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
						aria-label={m['orgAdmin.layout.toggleMenu']()}
						aria-expanded={mobileMenuOpen}
					>
						<Menu class="h-5 w-5" />
					</button>

					<h1 class="text-xl font-semibold">
						{data.organization.name}
						<span class="ml-2 text-sm font-normal text-muted-foreground"
							>{m['orgAdmin.layout.adminBadge']()}</span
						>
					</h1>
				</div>

				<!-- Right: Role Badge -->
				<div class="flex items-center gap-2">
					{#if data.isOwner}
						<span class="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
							Owner
						</span>
					{:else if data.isStaff}
						<span class="rounded-md bg-accent px-2 py-1 text-xs font-medium"
							>{m['orgAdmin.layout.staffBadge']()}</span
						>
					{/if}
				</div>
			</div>

			<!-- Breadcrumbs (Desktop only) -->
			<nav
				class="hidden border-t py-2.5 md:block"
				aria-label={m['orgAdmin.layout.breadcrumbNavigation']()}
			>
				<ol class="flex items-center gap-1.5 text-xs">
					{#each breadcrumbs as crumb, i}
						{#if i > 0}
							<li aria-hidden="true">
								<ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
							</li>
						{/if}
						<li class="flex items-center gap-1.5">
							{#if i === 0}
								<Home class="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
							{/if}
							<a
								href={crumb.href}
								class="text-muted-foreground/80 transition-colors hover:text-foreground"
								aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
							>
								{crumb.label}
							</a>
						</li>
					{/each}
				</ol>
			</nav>

			<!-- Desktop Navigation -->
			<nav class="hidden border-t md:block" aria-label={m['orgAdmin.layout.adminNavigation']()}>
				<ul class="flex gap-6">
					{#each navItems as item}
						<li>
							<a
								href={item.href}
								class="block border-b-2 py-4 text-sm font-medium transition-colors {isActive(
									item.href
								)
									? 'border-primary text-foreground'
									: 'border-transparent text-muted-foreground hover:text-foreground'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
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
					<h2 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
						{m['orgAdmin.layout.navigationHeading']()}
					</h2>
					<ol class="flex flex-wrap items-center gap-1.5 text-xs">
						{#each breadcrumbs as crumb, i}
							{#if i > 0}
								<li aria-hidden="true">
									<ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
								</li>
							{/if}
							<li class="flex items-center gap-1.5">
								{#if i === 0}
									<Home class="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
								{/if}
								<a
									href={crumb.href}
									onclick={closeMobileMenu}
									class="text-muted-foreground/80 transition-colors hover:text-foreground"
									aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
								>
									{crumb.label}
								</a>
							</li>
						{/each}
					</ol>
				</div>

				<!-- Nav Items -->
				<ul class="space-y-1">
					{#each navItems as item}
						<li>
							<a
								href={item.href}
								onclick={closeMobileMenu}
								class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(
									item.href
								)
									? 'bg-primary/10 text-primary'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	{/if}

	<!-- Main Content -->
	<main id="main-content" class="container mx-auto py-6">
		{@render children()}
	</main>
</div>
