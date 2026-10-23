<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Menu } from '@lucide/svelte';
	import MobileNav from '$lib/components/common/MobileNav.svelte';
	import UserMenu from '$lib/components/common/UserMenu.svelte';
	import ThemeToggle from '$lib/components/common/ThemeToggle.svelte';
	import LanguageSwitcher from '$lib/components/common/LanguageSwitcher.svelte';
	import { NotificationDropdown } from '$lib/components/notifications';
	import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';
	import { getImageUrl } from '$lib/utils/url';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		tenant: TenantOrganizationSchema;
	}

	const { tenant }: Props = $props();

	const MOBILE_MENU_ID = 'tenant-mobile-menu';

	let mobileMenuOpen = $state(false);

	const isAuthenticated = $derived(authStore.isAuthenticated);
	const accessToken = $derived(authStore.accessToken);
	const currentPath = $derived($page.url.pathname);

	const logoUrl = $derived(getImageUrl(tenant.logo_thumbnail_url || tenant.logo));

	// Events is the org page itself (it lists the organization's events). Membership
	// and Resources only appear when the org actually offers them.
	const navItems = $derived([
		{ href: resolve('/(public)', {}), label: m['tenantChrome.events']() },
		...(tenant.has_membership_plans || tenant.accept_membership_requests
			? [
					{
						href: resolve('/(public)/org/[slug]/membership', { slug: tenant.slug }),
						label: m['tenantChrome.membership']()
					}
				]
			: []),
		...(tenant.has_resources
			? [
					{
						href: resolve('/(public)/org/[slug]/resources', { slug: tenant.slug }),
						label: m['tenantChrome.resources']()
					}
				]
			: [])
	]);

	function isActive(href: string): boolean {
		return href === '/' ? currentPath === '/' : currentPath.startsWith(href);
	}

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
	<div class="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
		<div class="flex min-w-0 items-center gap-6">
			<a
				href={resolve('/(public)', {})}
				class="flex min-h-11 min-w-0 items-center gap-3 rounded-md text-foreground transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{#if logoUrl}
					<img src={logoUrl} alt="" class="h-9 w-9 shrink-0 rounded-md object-cover" />
				{:else}
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-poster-purple to-poster-crimson-deep text-base font-black text-poster-white"
						aria-hidden="true"
					>
						{tenant.name.charAt(0).toUpperCase()}
					</span>
				{/if}
				<span class="truncate text-base font-bold sm:text-lg">{tenant.name}</span>
			</a>

			<!-- Desktop Navigation -->
			<nav
				class="hidden md:flex md:items-center md:gap-6"
				aria-label={m['tenantChrome.mainNavigation']()}
			>
				{#each navItems as item (item.href)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the nav item list above -->
					<a
						href={item.href}
						class="rounded-sm py-2 text-sm transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring {isActive(
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

		<div class="flex shrink-0 items-center gap-2 sm:gap-4">
			<ThemeToggle />

			{#if isAuthenticated}
				{#if accessToken}
					<NotificationDropdown authToken={accessToken} />
				{/if}

				<div class="hidden md:block">
					<UserMenu />
				</div>
			{:else}
				<div class="hidden items-center gap-2 md:flex">
					<a
						href={resolve('/(public)/login', {})}
						class="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{m['auth.login']()}
					</a>
					<a
						href={resolve('/(public)/register', {})}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{m['auth.signUp']()}
					</a>
				</div>
			{/if}

			<button
				type="button"
				class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring md:hidden"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-expanded={mobileMenuOpen}
				aria-controls={MOBILE_MENU_ID}
				aria-label={m['nav.toggleMenu']()}
			>
				<Menu class="h-6 w-6" aria-hidden="true" />
			</button>

			<LanguageSwitcher />
		</div>
	</div>
</header>

<MobileNav
	id={MOBILE_MENU_ID}
	bind:open={mobileMenuOpen}
	{navItems}
	{isAuthenticated}
	onClose={closeMobileMenu}
/>
