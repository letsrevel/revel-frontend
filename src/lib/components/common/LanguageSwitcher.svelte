<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, setLocale, locales } from '$lib/paraglide/runtime.js';
	import { invalidateAll } from '$app/navigation';
	import { Globe } from 'lucide-svelte';

	// Current locale
	let currentLocale = $derived(getLocale());

	// Language options with flags
	const languages = [
		{ code: 'en', name: 'English', flag: '🇬🇧' },
		{ code: 'de', name: 'Deutsch', flag: '🇩🇪' },
		{ code: 'it', name: 'Italiano', flag: '🇮🇹' }
	] as const;

	// Dropdown open state
	let isOpen = $state(false);

	// Switch language
	async function switchLanguage(lang: string) {
		// Set locale
		setLocale(lang as any);

		// Update cookie
		document.cookie = `user_language=${lang}; path=/; max-age=31536000; SameSite=Lax`;

		// Close dropdown
		isOpen = false;

		// Reload all data with new language
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
