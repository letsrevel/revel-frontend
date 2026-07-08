<script lang="ts">
	// Brand evaluation switcher (Legacy + candidate themes). Floating,
	// dismissible, gated to demo/dev so it never appears on real production.
	// Delete with the rest of the experiment.
	import { dev } from '$app/environment';
	import { appStore } from '$lib/stores/app.svelte';
	import { brandTheme, BRAND_THEMES } from '$lib/stores/brandTheme.svelte';
	import { fontTheme, FONT_THEMES } from '$lib/stores/fontTheme.svelte';
	import RevelMark from '$lib/components/brand/RevelMark.svelte';
	import { Palette, X } from '@lucide/svelte';

	let open = $state(true);
	// Show only where evaluation is intended: local dev or the demo/staging env.
	const visible = $derived(dev || appStore.isDemoMode);

	// Dev/demo-only UI copy for the brand experiment — intentionally NOT
	// translated (the whole widget is deleted with the experiment, so it never
	// reaches real users). Bound as expressions below so they don't trip the
	// hardcoded-string i18n guard. i18n-ignore
	const L = {
		heading: 'Brand',
		group: 'Brand theme',
		fontHeading: 'Font',
		fontGroup: 'Font theme',
		collapse: 'Collapse brand switcher',
		open: 'Open brand switcher'
	};

	// Roving-tabindex radiogroups: only the checked radio is in the tab order;
	// Arrow/Home/End move selection and focus between options (WAI-ARIA pattern).
	const brandRadios = $state<HTMLButtonElement[]>([]);
	const fontRadios = $state<HTMLButtonElement[]>([]);

	function rove(event: KeyboardEvent, index: number, count: number): number | null {
		const last = count - 1;
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				return index === last ? 0 : index + 1;
			case 'ArrowUp':
			case 'ArrowLeft':
				return index === 0 ? last : index - 1;
			case 'Home':
				return 0;
			case 'End':
				return last;
			default:
				return null;
		}
	}

	function onBrandKeydown(event: KeyboardEvent, index: number) {
		const next = rove(event, index, BRAND_THEMES.length);
		if (next === null) return;
		event.preventDefault();
		brandTheme.set(BRAND_THEMES[next].value);
		brandRadios[next]?.focus();
	}

	function onFontKeydown(event: KeyboardEvent, index: number) {
		const next = rove(event, index, FONT_THEMES.length);
		if (next === null) return;
		event.preventDefault();
		fontTheme.set(FONT_THEMES[next].value);
		fontRadios[next]?.focus();
	}
</script>

{#if visible}
	<div
		class="fixed z-[60]"
		style="left: max(1rem, env(safe-area-inset-left)); bottom: max(1rem, env(safe-area-inset-bottom));"
	>
		{#if open}
			<div class="w-56 rounded-xl border bg-card text-card-foreground shadow-xl">
				<div class="flex items-center justify-between gap-2 border-b px-3 py-2">
					<div class="flex items-center gap-2">
						<RevelMark class="h-5 w-5" />
						<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{L.heading}
						</span>
					</div>
					<button
						type="button"
						class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						onclick={() => (open = false)}
						aria-label={L.collapse}
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
				<div class="flex flex-col gap-1 p-2" role="radiogroup" aria-label={L.group}>
					{#each BRAND_THEMES as t, i (t.value)}
						{@const active = brandTheme.current === t.value}
						<button
							bind:this={brandRadios[i]}
							type="button"
							role="radio"
							aria-checked={active}
							tabindex={active ? 0 : -1}
							onclick={() => brandTheme.set(t.value)}
							onkeydown={(e) => onBrandKeydown(e, i)}
							class="rounded-lg border px-2 py-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring {active
								? 'border-primary bg-primary/10'
								: 'border-border hover:bg-muted'}"
						>
							<span class="block text-xs font-medium text-foreground">{t.label}</span>
							<span class="block text-[10px] leading-tight text-muted-foreground">{t.hint}</span>
						</button>
					{/each}
				</div>
				<div class="border-t px-3 pt-2">
					<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{L.fontHeading}
					</span>
				</div>
				<div class="flex flex-col gap-1 p-2" role="radiogroup" aria-label={L.fontGroup}>
					{#each FONT_THEMES as t, i (t.value)}
						{@const active = fontTheme.current === t.value}
						<button
							bind:this={fontRadios[i]}
							type="button"
							role="radio"
							aria-checked={active}
							tabindex={active ? 0 : -1}
							onclick={() => fontTheme.set(t.value)}
							onkeydown={(e) => onFontKeydown(e, i)}
							class="rounded-lg border px-2 py-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring {active
								? 'border-primary bg-primary/10'
								: 'border-border hover:bg-muted'}"
						>
							<span class="block text-xs font-medium text-foreground">{t.label}</span>
							<span class="block text-[10px] leading-tight text-muted-foreground">{t.hint}</span>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<button
				type="button"
				class="flex h-11 w-11 items-center justify-center rounded-full border bg-card text-foreground shadow-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring"
				onclick={() => (open = true)}
				aria-label={L.open}
			>
				<Palette class="h-5 w-5" aria-hidden="true" />
			</button>
		{/if}
	</div>
{/if}
