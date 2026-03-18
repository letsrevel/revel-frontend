<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { Menu, ChevronRight, Home, AlertCircle } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	const { data, children }: Props = $props();

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Get current path
	const currentPath = $derived($page.url.pathname);

	// Admin navigation items
	const navItems = [
		{ href: `/org/${data.organization.slug}/admin`, label: m['orgAdmin.nav.dashboard']() },
		{ href: `/org/${data.organization.slug}/admin/events`, label: m['orgAdmin.nav.events']() },
		{
			href: `/org/${data.organization.slug}/admin/discount-codes`,
			label: m['orgAdmin.nav.discountCodes']()
		},
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
			href: `/org/${data.organization.slug}/admin/blacklist`,
			label: 'Blacklist'
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
			href: `/org/${data.organization.slug}/admin/venues`,
			label: m['orgAdmin.nav.venues']()
		},
		...(data.isOwner
			? [
					{
						href: `/org/${data.organization.slug}/admin/billing`,
						label: m['orgAdmin.nav.billing'](),
						badge:
							data.organization.is_stripe_connected &&
							(parseFloat(data.organization.platform_fee_percent) > 0 ||
								parseFloat(data.organization.platform_fee_fixed) > 0) &&
							(!data.organization.vat_country_code ||
								!data.organization.billing_address ||
								!data.organization.billing_name)
								? 'warning'
								: undefined
					}
				]
			: []),
		{ href: `/org/${data.organization.slug}/admin/settings`, label: m['orgAdmin.nav.settings']() },
		{
			href: `/org/${data.organization.slug}/admin/announcements`,
			label: m['orgAdmin.nav.announcements']()
		}
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
	const breadcrumbs = $derived([
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
			<div class="flex h-16 items-center justify-between gap-2">
				<!-- Left: Org Name & Admin Badge -->
				<div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
					<button
						type="button"
						onclick={toggleMobileMenu}
						class="shrink-0 rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
						aria-label={m['orgAdmin.layout.toggleMenu']()}
						aria-expanded={mobileMenuOpen}
					>
						<Menu class="h-5 w-5" />
					</button>

					<h1 class="min-w-0 truncate text-base font-semibold sm:text-xl">
						{data.organization.name}
						<span class="ml-2 text-sm font-normal text-muted-foreground"
							>{m['orgAdmin.layout.adminBadge']()}</span
						>
					</h1>
				</div>

				<!-- Right: Role Badge -->
				<div class="flex shrink-0 items-center gap-2">
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
								class="relative block border-b-2 py-4 text-sm font-medium transition-colors {isActive(
									item.href
								)
									? 'border-primary text-foreground'
									: 'border-transparent text-muted-foreground hover:text-foreground'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								{item.label}
								{#if item.badge === 'warning'}
									<span
										class="absolute -right-1.5 top-3 flex h-2.5 w-2.5"
										title={m['common.actionRequired']()}
										role="status"
										aria-label={m['common.actionRequired']()}
									>
										<span class="absolute h-full w-full animate-ping rounded-full bg-destructive/60"
										></span>
										<span class="relative h-2 w-2 rounded-full bg-destructive"></span>
									</span>
								{/if}
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
								class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(
									item.href
								)
									? 'bg-primary/10 text-primary'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								{item.label}
								{#if item.badge === 'warning'}
									<span
										class="h-2 w-2 rounded-full bg-destructive"
										role="status"
										aria-label={m['common.actionRequired']()}
									></span>
								{/if}
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
