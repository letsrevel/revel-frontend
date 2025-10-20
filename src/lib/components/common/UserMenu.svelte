<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { dashboardDashboardOrganizations88A0E87D } from '$lib/api/generated/sdk.gen';
	import { User, Settings, LogOut, Building2, Shield, Lock } from 'lucide-svelte';

	interface Props {
		mobile?: boolean;
		onItemClick?: () => void;
	}

	let { mobile = false, onItemClick }: Props = $props();

	let dropdownOpen = $state(false);
	let user = $derived(authStore.user);
	let accessToken = $derived(authStore.accessToken);

	// Fetch user's organizations (where they are owner or staff)
	const organizationsQuery = createQuery(() => ({
		queryKey: ['user-organizations'],
		queryFn: async () => {
			if (!accessToken) return [];

			const response = await dashboardDashboardOrganizations88A0E87D({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				query: {
					page_size: 50 // Get up to 50 orgs
				}
			});

			return response.data?.results || [];
		},
		enabled: !!accessToken
	}));

	let userOrganizations = $derived(organizationsQuery.data || []);

	// Get user initials for avatar
	let userInitials = $derived(() => {
		if (!user) return '?';
		const first = user.first_name?.[0] || '';
		const last = user.last_name?.[0] || '';
		return (first + last).toUpperCase() || user.email[0].toUpperCase();
	});

	// Get display name
	let displayName = $derived(
		user?.preferred_name || user?.first_name || user?.email.split('@')[0] || 'User'
	);

	// Menu items
	const menuItems = [
		{ href: '/account/profile', label: 'Profile', icon: User },
		{ href: '/account/security', label: 'Security', icon: Shield },
		{ href: '/account/privacy', label: 'Privacy & Data', icon: Lock },
		{ href: '/account/settings', label: 'Settings', icon: Settings }
	];

	function handleLogout() {
		if (onItemClick) onItemClick();
		// Navigate to logout endpoint which clears cookies and redirects
		// The $effect in root layout will handle clearing client-side state
		goto('/logout');
	}

	function handleItemClick() {
		dropdownOpen = false;
		if (onItemClick) onItemClick();
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-user-menu]')) {
			dropdownOpen = false;
		}
	}

	$effect(() => {
		if (dropdownOpen && !mobile) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
		return undefined;
	});
</script>

{#if mobile}
	<!-- Mobile User Menu -->
	<div class="space-y-2">
		<div class="flex items-center gap-3 rounded-md bg-muted p-4">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
			>
				{userInitials()}
			</div>
			<div class="flex-1">
				<p class="font-medium">{displayName}</p>
				<p class="text-sm text-muted-foreground">{user?.email}</p>
			</div>
		</div>

		{#each menuItems as item}
			{@const Icon = item.icon}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-md px-4 py-3 text-base transition-colors hover:bg-accent hover:text-accent-foreground"
				onclick={handleItemClick}
			>
				<Icon class="h-5 w-5" aria-hidden="true" />
				<span>{item.label}</span>
			</a>
		{/each}

		<!-- Organizations Section (Mobile) -->
		{#if userOrganizations.length > 0}
			<div class="space-y-2 border-t pt-4">
				<div class="px-4 text-sm font-semibold text-muted-foreground">My Organizations</div>
				{#each userOrganizations as org}
					<div class="space-y-1">
						<a
							href="/org/{org.slug}"
							class="flex items-center gap-3 rounded-md px-4 py-2 text-base transition-colors hover:bg-accent hover:text-accent-foreground"
							onclick={handleItemClick}
						>
							<Building2 class="h-5 w-5" aria-hidden="true" />
							<span class="flex-1 truncate">{org.name}</span>
						</a>
						<a
							href="/org/{org.slug}/admin"
							class="ml-12 flex items-center gap-2 rounded-md px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
							onclick={handleItemClick}
						>
							<Shield class="h-4 w-4" aria-hidden="true" />
							<span>Admin Dashboard</span>
						</a>
					</div>
				{/each}
			</div>
		{/if}

		<button
			type="button"
			class="mt-4 flex w-full items-center gap-3 rounded-md border-t px-4 py-3 pt-6 text-base text-destructive transition-colors hover:bg-destructive/10"
			onclick={handleLogout}
		>
			<LogOut class="h-5 w-5" aria-hidden="true" />
			<span>Logout</span>
		</button>
	</div>
{:else}
	<!-- Desktop User Menu -->
	<div class="relative z-50" data-user-menu>
		<button
			type="button"
			class="flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			onclick={() => (dropdownOpen = !dropdownOpen)}
			aria-expanded={dropdownOpen}
			aria-haspopup="true"
			aria-label="User menu"
		>
			<div
				class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
			>
				{userInitials()}
			</div>
			<span class="hidden text-sm font-medium lg:block">{displayName}</span>
		</button>

		{#if dropdownOpen}
			<div
				class="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md border bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
				role="menu"
				aria-orientation="vertical"
			>
				<!-- User Info -->
				<div class="border-b px-4 py-3">
					<p class="text-sm font-medium">{displayName}</p>
					<p class="text-xs text-muted-foreground">{user?.email}</p>
				</div>

				<!-- Menu Items -->
				<div class="p-1">
					{#each menuItems as item}
						{@const Icon = item.icon}
						<a
							href={item.href}
							class="flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
							onclick={handleItemClick}
							role="menuitem"
						>
							<Icon class="h-4 w-4" aria-hidden="true" />
							<span>{item.label}</span>
						</a>
					{/each}
				</div>

				<!-- Organizations Section -->
				{#if userOrganizations.length > 0}
					<div class="border-t">
						<div class="p-1">
							<div class="px-3 py-2 text-xs font-semibold text-muted-foreground">
								My Organizations
							</div>
							{#each userOrganizations as org}
								<div class="space-y-1">
									<a
										href="/org/{org.slug}"
										class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
										onclick={handleItemClick}
										role="menuitem"
									>
										<Building2 class="h-4 w-4" aria-hidden="true" />
										<span class="flex-1 truncate">{org.name}</span>
									</a>
									<a
										href="/org/{org.slug}/admin"
										class="ml-7 flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
										onclick={handleItemClick}
										role="menuitem"
									>
										<Shield class="h-3 w-3" aria-hidden="true" />
										<span>Admin Dashboard</span>
									</a>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Logout -->
				<div class="border-t p-1">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
						onclick={handleLogout}
						role="menuitem"
					>
						<LogOut class="h-4 w-4" aria-hidden="true" />
						<span>Logout</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
