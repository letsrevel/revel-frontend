<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, setLocale, locales } from '$lib/paraglide/runtime.js';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Globe } from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { accountUpdateLanguage } from '$lib/api/client';
	import { getLanguageSwitchUrl } from '$lib/utils/seo-routes';

	// Current locale
	let currentLocale = $derived(getLocale());

	// Language options with flags
	const languages = [
		{ code: 'en', name: 'English', flag: '🇬🇧' },
		{ code: 'de', name: 'Deutsch', flag: '🇩🇪' },
		{ code: 'it', name: 'Italiano', flag: '🇮🇹' }
	] as const;

	type SupportedLanguage = 'en' | 'de' | 'it';

	// Dropdown open state
	let isOpen = $state(false);

	// Switch language
	async function switchLanguage(lang: string) {
		const typedLang = lang as SupportedLanguage;

		// Check if we need to navigate to a different URL (SEO pages)
		// Use window.location.pathname for reliability
		const currentPath =
			typeof window !== 'undefined' ? window.location.pathname : page.url.pathname;
		const redirectUrl = getLanguageSwitchUrl(currentPath, lang);

		// Close dropdown immediately
		isOpen = false;

		// Update cookie (for non-logged-in users and SSR)
		document.cookie = `user_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;

		// If user is logged in, persist to backend
		// IMPORTANT: We must await this call before invalidateAll() to prevent a race condition.
		// Without await, fetchUserData() would reset the locale to the old language from the backend.
		if (authStore.isAuthenticated) {
			try {
				await accountUpdateLanguage({
					body: { language: typedLang },
					headers: authStore.getAuthHeaders()
				});
			} catch (error) {
				console.error('[LanguageSwitcher] Failed to update language in backend:', error);
				// Continue with local language change even if backend update fails
			}
		}

		// For SEO pages, navigate directly WITHOUT calling setLocale
		// The new page will have the correct language based on the URL and cookie
		if (redirectUrl) {
			// Use window.location for a full page navigation to avoid race conditions
			window.location.href = redirectUrl;
			return;
		}

		// For regular pages, use Paraglide's locale switching
		setLocale(typedLang);
		await invalidateAll();
	}

	// Get current language details
	let currentLanguage = $derived(
		languages.find((lang) => lang.code === currentLocale) || languages[0]
	);
</script>

<!-- Language Switcher Dropdown -->
<div class="relative">
	<!-- Trigger Button - Just the flag -->
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center justify-center rounded-md p-2 text-2xl transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
		aria-label={m['languageSwitcher.selectLanguage']({ name: currentLanguage.name })}
		aria-expanded={isOpen}
		aria-haspopup="true"
		title={currentLanguage.name}
	>
		{currentLanguage.flag}
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			role="menu"
		>
			{#each languages as lang}
				<button
					type="button"
					onclick={() => switchLanguage(lang.code)}
					class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground {currentLocale ===
					lang.code
						? 'bg-accent/50 font-medium'
						: ''}"
					role="menuitem"
				>
					<span class="text-lg">{lang.flag}</span>
					<span>{lang.name}</span>
					{#if currentLocale === lang.code}
						<span class="ml-auto text-xs text-muted-foreground">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => (isOpen = false)}
		aria-label={m['languageSwitcher.closeMenu']()}
		tabindex="-1"
	></button>
{/if}
