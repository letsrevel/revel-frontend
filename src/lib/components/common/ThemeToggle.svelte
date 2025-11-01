<script lang="ts">
	import { mode, setMode } from 'mode-watcher';
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	let dropdownOpen = $state(false);

	// Using derived for reactivity
	let themes = $derived([
		{ value: 'light' as const, label: m['theme.light'](), icon: Sun },
		{ value: 'dark' as const, label: m['theme.dark'](), icon: Moon },
		{ value: 'system' as const, label: m['theme.system'](), icon: Monitor }
	]);

	function selectTheme(theme: 'light' | 'dark' | 'system') {
		setMode(theme);
		dropdownOpen = false;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-theme-toggle]')) {
			dropdownOpen = false;
		}
	}

	$effect(() => {
		if (dropdownOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
		return undefined;
	});
</script>

<div class="relative" data-theme-toggle>
	<button
		type="button"
		class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
		onclick={() => (dropdownOpen = !dropdownOpen)}
		aria-label={m['theme.toggleTheme']()}
		aria-expanded={dropdownOpen}
		aria-haspopup="true"
	>
		{#if $mode === 'light'}
			<Sun class="h-5 w-5" aria-hidden="true" />
		{:else if $mode === 'dark'}
			<Moon class="h-5 w-5" aria-hidden="true" />
		{:else}
			<Monitor class="h-5 w-5" aria-hidden="true" />
		{/if}
	</button>

	{#if dropdownOpen}
		<div
			class="absolute right-0 mt-2 w-40 origin-top-right rounded-md border bg-popover p-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
			role="menu"
			aria-orientation="vertical"
			aria-labelledby="theme-menu"
		>
			{#each themes as theme}
				{@const Icon = theme.icon}
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground {$mode ===
					theme.value
						? 'bg-accent text-accent-foreground'
						: 'text-popover-foreground'}"
					onclick={() => selectTheme(theme.value)}
					role="menuitem"
				>
					<Icon class="h-4 w-4" aria-hidden="true" />
					<span>{theme.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
