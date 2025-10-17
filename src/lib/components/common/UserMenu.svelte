<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { User, Settings, LogOut, Building2 } from 'lucide-svelte';

	interface Props {
		mobile?: boolean;
		onItemClick?: () => void;
	}

	let { mobile = false, onItemClick }: Props = $props();

	let dropdownOpen = $state(false);
	let user = $derived(authStore.user);

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
		{ href: '/account/settings', label: 'Settings', icon: Settings },
		{ href: '/my-organizations', label: 'My Organizations', icon: Building2 }
	];

	async function handleLogout() {
		await authStore.logout();
		if (onItemClick) onItemClick();
		goto('/');
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

		<button
			type="button"
			class="flex w-full items-center gap-3 rounded-md px-4 py-3 text-base text-destructive transition-colors hover:bg-destructive/10"
			onclick={handleLogout}
		>
			<LogOut class="h-5 w-5" aria-hidden="true" />
			<span>Logout</span>
		</button>
	</div>
{:else}
	<!-- Desktop User Menu -->
	<div class="relative" data-user-menu>
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
				class="absolute right-0 mt-2 w-56 origin-top-right rounded-md border bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
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
