<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { navLoginHref } from '$lib/utils/safe-redirect';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Menu } from '@lucide/svelte';
	import MobileNav from './MobileNav.svelte';
	import UserMenu from './UserMenu.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import AdminButton from './AdminButton.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { NotificationDropdown } from '$lib/components/notifications';
	import * as m from '$lib/paraglide/messages.js';
	import RevelWordmark from '$lib/components/brand/RevelWordmark.svelte';

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Get auth state
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const accessToken = $derived(authStore.accessToken);
	const currentPath = $derived($page.url.pathname);

	// Navigation items for public users - using translated strings
	const publicNavItems = $derived([
		{ href: resolve('/(public)/events', {}), label: m['nav.browseEvents']() },
		{ href: resolve('/(public)/organizations', {}), label: m['nav.organizations']() }
	]);

	// Navigation items for authenticated users - using translated strings
	const authNavItems = $derived([
		{ href: resolve('/(public)/events', {}), label: m['nav.browseEvents']() },
		{ href: resolve('/(public)/organizations', {}), label: m['nav.organizations']() },
		{ href: resolve('/(auth)/dashboard/tickets', {}), label: m['dashboard.tickets.title']() },
		{ href: resolve('/(auth)/dashboard/passes', {}), label: m['seriesPass.myPassesTitle']() },
		{ href: resolve('/(auth)/dashboard/rsvps', {}), label: m['dashboard.rsvps.title']() },
		{
			href: resolve('/(auth)/dashboard/invitations', {}),
			label: m['dashboard.invitations.title']()
		}
	]);

	// Determine which nav items to show
	const navItems = $derived(isAuthenticated ? authNavItems : publicNavItems);

	// Signed-in users get six nav links, which only fit on one line from xl
	// (1280px) up; below that they use the menu button. Short navs keep md.
	const wideNav = $derived(navItems.length > 3);
	const desktopNavClass = $derived(
		wideNav ? 'hidden xl:flex xl:items-center xl:gap-6' : 'hidden md:flex md:items-center md:gap-6'
	);
	const menuButtonClass = $derived(wideNav ? 'xl:hidden' : 'md:hidden');

	// Check if link is active
	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Close mobile menu
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<header
	class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="container mx-auto flex h-16 items-center justify-between px-6 md:px-8">
		<!-- Logo -->
		<div class="flex items-center gap-6">
			<a
				href={resolve('/(public)', {})}
				class="text-foreground transition-opacity hover:opacity-80"
			>
				<!-- "let's revel." lockup — its visible text is the link's
				     accessible name (WCAG 2.5.3 Label in Name). Stepped down a
				     size below `sm` so it fits beside the logged-in icon row. -->
				<RevelWordmark class="text-xl sm:text-2xl" />
			</a>

			<!-- Desktop Navigation -->
			<nav class={desktopNavClass} aria-label={m['header.mainNavigation']()}>
				{#each navItems as item (item.href)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the nav item list above -->
					<a
						href={item.href}
						class="whitespace-nowrap text-sm transition-colors hover:text-primary {isActive(
							item.href
						)
							? 'font-bold text-primary'
							: 'font-semibold text-muted-foreground'}"
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{item.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/each}
			</nav>
		</div>

		<!-- Right side actions -->
		<div class="flex items-center gap-2 sm:gap-4">
			<!-- Admin Button (Desktop, Authenticated) -->
			{#if isAuthenticated}
				<div class="hidden md:block">
					<AdminButton />
				</div>
			{/if}

			<!-- Theme Toggle -->
			<ThemeToggle />

			{#if isAuthenticated}
				<!-- Notification Dropdown -->
				{#if accessToken}
					<NotificationDropdown authToken={accessToken} />
				{/if}

				<!-- User Menu (Desktop) -->
				<div class="hidden md:block">
					<UserMenu />
				</div>
			{:else}
				<!-- Auth Buttons (Desktop) -->
				<div class="hidden items-center gap-2 md:flex">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- navLoginHref() wraps resolve(); it only appends the query -->
					<a
						href={navLoginHref($page.url)}
						class="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{m['auth.login']()}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<a
						href={resolve('/(public)/register', {})}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						{m['auth.signUp']()}
					</a>
				</div>
			{/if}

			<!-- Mobile Menu Button -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring {menuButtonClass}"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-expanded={mobileMenuOpen}
				aria-label={m['nav.toggleMenu']()}
			>
				<Menu class="h-6 w-6" aria-hidden="true" />
			</button>

			<!-- Language Switcher (Rightmost) -->
			<LanguageSwitcher />
		</div>
	</div>
</header>

<!-- Mobile Navigation -->
<MobileNav
	bind:open={mobileMenuOpen}
	{navItems}
	{isAuthenticated}
	{wideNav}
	onClose={closeMobileMenu}
/>
