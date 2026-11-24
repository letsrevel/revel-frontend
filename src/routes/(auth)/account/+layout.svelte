<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cn } from '$lib/utils';
	import * as m from '$lib/paraglide/messages.js';
	import { getAccountNavItems } from '$lib/components/common/account-nav';
	import { locales, baseLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		children: import('svelte').Snippet;
	}

	const { children }: Props = $props();

	// Same entries, order, labels and visibility rules as the user menu.
	const features = $derived(page.data.features);
	const isTenant = $derived(!!page.data.tenant);

	const items = $derived(
		getAccountNavItems({
			oauthEnabled: !!features?.oauth_provider,
			isTenant,
			referralCode: authStore.user?.referral_code
		})
	);

	const localePrefix = new RegExp(
		`^/(?:${locales.filter((l) => l !== baseLocale).join('|')})(?=/)`
	);

	// The URL may carry a locale prefix (`/de/account/...`); compare without it.
	const pathname = $derived(page.url.pathname.replace(localePrefix, ''));

	// Longest matching href wins, so `/account/referral/payouts` does not also
	// light up `/account/referral`, while `/account/developer-apps/new` still
	// belongs to Developer apps.
	const activeHref = $derived(
		items
			.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
			.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
	);

	let navEl: HTMLElement | undefined = $state();

	// On narrow screens the tab row scrolls; keep the current tab in view.
	function revealCurrent(): void {
		const current = navEl?.querySelector<HTMLElement>('[aria-current="page"]');
		if (!navEl || !current) return;
		const target = current.offsetLeft - (navEl.clientWidth - current.offsetWidth) / 2;
		navEl.scrollLeft = Math.max(0, target);
	}

	onMount(revealCurrent);
	$effect(() => {
		void activeHref;
		revealCurrent();
	});
</script>

<div class="container mx-auto max-w-6xl px-4 py-6 lg:py-8">
	<div class="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
		<!-- Mobile: scrollable tab row. Desktop: sticky side nav. -->
		<nav
			bind:this={navEl}
			aria-label={m['accountNav.label']()}
			class="-mx-4 mb-6 overflow-x-auto px-4 py-1 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:self-start lg:overflow-visible lg:px-0 lg:py-0"
		>
			<ul class="flex gap-2 lg:flex-col lg:gap-1">
				{#each items as item (item.href)}
					{@const current = item.href === activeHref}
					<li class="shrink-0">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- item.href is built with resolve() in getAccountNavItems() -->
						<a
							href={item.href}
							aria-current={current ? 'page' : undefined}
							class={cn(
								'flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:border-transparent',
								current
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
							)}
						>
							<item.icon class="h-4 w-4 shrink-0" aria-hidden="true" />
							<span>{item.label}</span>
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		</nav>

		<div class="min-w-0">
			{@render children()}
		</div>
	</div>
</div>
