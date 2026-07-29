<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<svelte:head>
	<!--
		Embeds are a syndication surface, not a canonical one: the real page is
		the app page they link out to, which is what search engines should index.
	-->
	<meta name="robots" content="noindex, follow" />
	<!--
		Height reporting for the loader script's auto-resize. Static, versioned
		and ~1 KB — the only JavaScript an embed loads, since these pages set
		`csr = false`. Also re-applies `?theme=auto` when the host's colour
		scheme changes at runtime (there is no ModeWatcher here).
	-->
	<script src="/embed-frame-v1.js" defer></script>
</svelte:head>

<div class="embed-root bg-background text-foreground">
	{@render children()}
</div>

<style>
	/*
	 * The iframe is sized to this element's height by the loader script, so the
	 * document must never grow its own scrollbar or add margin around the card.
	 */
	.embed-root {
		min-height: 0;
		overflow-x: hidden;
	}

	:global(html:has(.embed-root)),
	:global(html:has(.embed-root) body) {
		margin: 0;
		padding: 0;
		/* Let the host page's own background show through any rounding. */
		background: transparent;
	}
</style>
