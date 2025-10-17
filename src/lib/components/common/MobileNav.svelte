<script lang="ts">
	import { page } from '$app/stores';
	import { X } from 'lucide-svelte';
	import UserMenu from './UserMenu.svelte';

	interface Props {
		open: boolean;
		navItems: Array<{ href: string; label: string }>;
		isAuthenticated: boolean;
		onClose: () => void;
	}

	let { open = $bindable(false), navItems, isAuthenticated, onClose }: Props = $props();

	let currentPath = $derived($page.url.pathname);

	// Check if link is active
	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Handle link click
	function handleLinkClick() {
		onClose();
	}

	// Close on Escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	// Focus trap management
	$effect(() => {
		if (open) {
			// Add event listener for Escape key
			document.addEventListener('keydown', handleKeydown);
			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			return () => {
				document.removeEventListener('keydown', handleKeydown);
				document.body.style.overflow = '';
			};
		}
		return undefined;
	});
</script>

<!-- Backdrop -->
{#if open}
	<div
		class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
		onclick={handleBackdropClick}
		role="presentation"
	></div>
{/if}

<!-- Mobile Menu Drawer -->
<div
	class="fixed right-0 top-0 z-50 h-full w-full max-w-sm transform border-l bg-background shadow-lg transition-transform duration-300 ease-in-out md:hidden {open
		? 'translate-x-0'
		: 'translate-x-full'}"
	role="dialog"
	aria-modal="true"
	aria-label="Mobile navigation"
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-4">
			<span class="text-lg font-semibold">Menu</span>
			<button
				type="button"
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				onclick={onClose}
				aria-label="Close menu"
			>
				<X class="h-6 w-6" aria-hidden="true" />
			</button>
		</div>

		<!-- Navigation Links -->
		<nav class="flex-1 overflow-y-auto p-4" aria-label="Mobile navigation">
			<ul class="space-y-2">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class="block rounded-md px-4 py-3 text-base font-medium transition-colors {isActive(
								item.href
							)
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
							onclick={handleLinkClick}
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>

			<!-- Auth Actions -->
			{#if !isAuthenticated}
				<div class="mt-6 space-y-2 border-t pt-6">
					<a
						href="/login"
						class="block rounded-md px-4 py-3 text-center text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						onclick={handleLinkClick}
					>
						Login
					</a>
					<a
						href="/register"
						class="block rounded-md bg-primary px-4 py-3 text-center text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						onclick={handleLinkClick}
					>
						Sign Up
					</a>
				</div>
			{:else}
				<!-- User Menu in Mobile -->
				<div class="mt-6 border-t pt-6">
					<UserMenu mobile={true} onItemClick={handleLinkClick} />
				</div>
			{/if}
		</nav>
	</div>
</div>
