<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { navLoginHref } from '$lib/utils/safe-redirect';
	import { tick } from 'svelte';
	import { X } from '@lucide/svelte';
	import UserMenu from './UserMenu.svelte';
	import { BREAKPOINT_MD_PX, BREAKPOINT_XL_PX } from '$lib/utils/breakpoints';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		open: boolean;
		navItems: Array<{ href: string; label: string }>;
		isAuthenticated: boolean;
		onClose: () => void;
		/** Optional id so a toggle button can reference the drawer via aria-controls. */
		id?: string;
		/** The header shows its menu button up to xl (long nav), not only below md. */
		wideNav?: boolean;
	}

	let {
		open = $bindable(false),
		navItems,
		isAuthenticated,
		onClose,
		id,
		wideNav = false
	}: Props = $props();

	const currentPath = $derived($page.url.pathname);

	// Check if link is active
	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// Handle link click
	function handleLinkClick() {
		onClose();
	}

	let drawer = $state<HTMLDivElement>();
	let closeButton = $state<HTMLButtonElement>();

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function focusableInDrawer(): HTMLElement[] {
		if (!drawer) return [];
		return Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
	}

	// Keep Tab inside the open drawer: aria-modal tells screen readers the page
	// behind it is inert, so keyboard focus must not reach it either (WCAG 2.4.3).
	function trapTab(event: KeyboardEvent): void {
		const items = focusableInDrawer();
		if (items.length === 0) {
			event.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		const inside = !!drawer && active instanceof Node && drawer.contains(active);
		if (!inside) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
		} else if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'Tab') {
			trapTab(event);
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	// The drawer is hidden by CSS above the breakpoint; close it there too so the
	// backdrop and the body scroll lock cannot outlive it after a resize/rotate.
	$effect(() => {
		if (!open || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return undefined;
		}
		const query = window.matchMedia(
			`(min-width: ${wideNav ? BREAKPOINT_XL_PX : BREAKPOINT_MD_PX}px)`
		);
		const onChange = (event: MediaQueryListEvent): void => {
			if (event.matches) onClose();
		};
		if (query.matches) {
			onClose();
			return undefined;
		}
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	// Focus management: move focus in on open, trap Tab while open, and give
	// focus back to the opener on close.
	$effect(() => {
		if (open) {
			const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			document.addEventListener('keydown', handleKeydown);
			// Prevent body scroll
			document.body.style.overflow = 'hidden';
			// Wait for the DOM update that removes `inert`, else focus() is a no-op.
			void tick().then(() => {
				if (open) closeButton?.focus();
			});

			return () => {
				document.removeEventListener('keydown', handleKeydown);
				document.body.style.overflow = '';
				// The closed drawer is inert, so focus left in it would fall to <body>.
				// Callers may move focus themselves first; only restore when they did not.
				const active = document.activeElement;
				const stranded =
					active === null ||
					active === document.body ||
					(!!drawer && active instanceof Node && drawer.contains(active));
				if (stranded && opener?.isConnected) opener.focus();
			};
		}
		return undefined;
	});
</script>

<!-- Backdrop -->
{#if open}
	<div
		class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm {wideNav
			? 'xl:hidden'
			: 'md:hidden'}"
		onclick={handleBackdropClick}
		role="presentation"
	></div>
{/if}

<!-- Mobile Menu Drawer -->
<div
	class="fixed right-0 top-0 z-50 h-full w-full max-w-sm transform border-l bg-background shadow-lg transition-transform duration-300 ease-in-out {wideNav
		? 'xl:hidden'
		: 'md:hidden'} {open ? 'translate-x-0' : 'translate-x-full'}"
	{id}
	bind:this={drawer}
	inert={!open}
	aria-hidden={open ? undefined : 'true'}
	role="dialog"
	aria-modal="true"
	aria-label={m['nav.mobileNavigation']()}
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-4">
			<span role="heading" aria-level="2" class="text-lg font-semibold">{m['nav.menu']()}</span>
			<button
				type="button"
				class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				bind:this={closeButton}
				onclick={onClose}
				aria-label={m['nav.closeMenu']()}
			>
				<X class="h-6 w-6" aria-hidden="true" />
			</button>
		</div>

		<!-- Navigation Links -->
		<nav class="flex-1 overflow-y-auto p-4" aria-label={m['nav.mobileNavigation']()}>
			<ul class="space-y-2">
				{#each navItems as item (item.href)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the nav item list above -->
						<a
							href={item.href}
							class="block rounded-md px-4 py-3 text-base transition-colors {isActive(item.href)
								? 'bg-accent font-bold text-accent-foreground'
								: 'font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
							onclick={handleLinkClick}
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							{item.label}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>

			<!-- Auth Actions -->
			{#if !isAuthenticated}
				<div class="mt-6 space-y-2 border-t pt-6">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- navLoginHref() wraps resolve(); it only appends the query -->
					<a
						href={navLoginHref($page.url)}
						class="block rounded-md px-4 py-3 text-center text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						onclick={handleLinkClick}
					>
						{m['auth.login']()}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<a
						href={resolve('/(public)/register', {})}
						class="block rounded-md bg-primary px-4 py-3 text-center text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						onclick={handleLinkClick}
					>
						{m['auth.signUp']()}
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
