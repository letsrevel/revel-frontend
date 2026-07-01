<script lang="ts">
	// Brand A/B/Legacy evaluation switcher. Floating, dismissible, gated to
	// demo/dev so it never appears on real production. Delete with the rest of
	// the experiment.
	import { dev } from '$app/environment';
	import { appStore } from '$lib/stores/app.svelte';
	import { brandTheme, BRAND_THEMES } from '$lib/stores/brandTheme.svelte';
	import RevelMark from '$lib/components/brand/RevelMark.svelte';
	import { Palette, X } from 'lucide-svelte';

	let open = $state(true);
	// Show only where evaluation is intended: local dev or the demo/staging env.
	const visible = $derived(dev || appStore.isDemoMode);
</script>

{#if visible}
	<div
		class="fixed bottom-4 left-4 z-[60]"
		style="left: max(1rem, env(safe-area-inset-left)); bottom: max(1rem, env(safe-area-inset-bottom));"
	>
		{#if open}
			<div class="w-56 rounded-xl border bg-card text-card-foreground shadow-xl">
				<div class="flex items-center justify-between gap-2 border-b px-3 py-2">
					<div class="flex items-center gap-2">
						<RevelMark class="h-5 w-5" />
						<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Brand A/B
						</span>
					</div>
					<button
						type="button"
						class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						onclick={() => (open = false)}
						aria-label="Collapse brand switcher"
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
				<div class="grid grid-cols-3 gap-1.5 p-2" role="radiogroup" aria-label="Brand theme">
					{#each BRAND_THEMES as t (t.value)}
						{@const active = brandTheme.current === t.value}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							onclick={() => brandTheme.set(t.value)}
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
				aria-label="Open brand switcher"
			>
				<Palette class="h-5 w-5" aria-hidden="true" />
			</button>
		{/if}
	</div>
{/if}
