<script lang="ts">
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Menu } from 'lucide-svelte';
	import MobileNav from './MobileNav.svelte';
	import UserMenu from './UserMenu.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import AdminButton from './AdminButton.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import * as m from '$lib/paraglide/messages.js';

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Get auth state
	let isAuthenticated = $derived(authStore.isAuthenticated);
	let currentPath = $derived($page.url.pathname);

	// Navigation items for public users - using translated strings
	let publicNavItems = $derived([
		{ href: '/events', label: m['nav.browseEvents']() },
		{ href: '/organizations', label: m['nav.organizations']() }
	]);

	// Navigation items for authenticated users - using translated strings
	let authNavItems = $derived([
		{ href: '/events', label: m['nav.browseEvents']() },
		{ href: '/organizations', label: m['nav.organizations']() },
		{ href: '/dashboard/tickets', label: m['nav.myTickets']() },
		{ href: '/dashboard/rsvps', label: m['nav.rsvps']() },
		{ href: '/dashboard/invitations', label: m['nav.invitations']() }
	]);

	// Determine which nav items to show
	let navItems = $derived(isAuthenticated ? authNavItems : publicNavItems);

	// Check if link is active
	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Close mobile menu
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<!-- Skip to main content link (accessibility) -->
<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
>
	{m['nav.skipToContent']()}
</a>

<header
	class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="container mx-auto flex h-16 items-center justify-between px-4">
		<!-- Logo -->
		<div class="flex items-center gap-6">
			<a
				href={isAuthenticated ? '/dashboard' : '/'}
				class="text-2xl font-bold text-primary transition-colors hover:text-primary/80"
			>
				Revel
			</a>

			<!-- Desktop Navigation -->
			<nav class="hidden md:flex md:items-center md:gap-6" aria-label="Main navigation">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class="text-sm font-medium transition-colors hover:text-primary {isActive(item.href)
							? 'text-foreground'
							: 'text-muted-foreground'}"
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>

		<!-- Right side actions -->
		<div class="flex items-center gap-4">
			<!-- Admin Button (Desktop, Authenticated) -->
			{#if isAuthenticated}
				<div class="hidden md:block">
					<AdminButton />
				</div>
			{/if}

			<!-- Theme Toggle -->
			<ThemeToggle />

			{#if isAuthenticated}
				<!-- User Menu (Desktop) -->
				<div class="hidden md:block">
					<UserMenu />
				</div>
			{:else}
				<!-- Auth Buttons (Desktop) -->
				<div class="hidden items-center gap-2 md:flex">
					<a
						href="/login"
						class="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{m['auth.login']()}
					</a>
					<a
						href="/register"
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						{m['auth.signUp']()}
					</a>
				</div>
			{/if}

			<!-- Mobile Menu Button -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring md:hidden"
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
<MobileNav bind:open={mobileMenuOpen} {navItems} {isAuthenticated} onClose={closeMobileMenu} />
