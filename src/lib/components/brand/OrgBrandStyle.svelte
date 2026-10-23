<script lang="ts">
	import { buildBrandThemeCss, type BrandThemeInput } from '$lib/utils/brand-theme';

	/**
	 * Applies an organization's brand colors (#1053) by overriding theme tokens.
	 *
	 * The override is scoped to `<html>` (`:root`), not a page wrapper, because
	 * dialogs, sheets, popovers and toasts portal to `<body>` and must pick up the
	 * org colors too. Rendered once from the root layout; renders nothing when the
	 * theme is null/invalid, and the style leaves `<head>` on unmount.
	 */
	interface Props {
		theme: BrandThemeInput | null | undefined;
	}

	const { theme }: Props = $props();

	const css = $derived(buildBrandThemeCss(theme));
</script>

<svelte:head>
	{#if css}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- css is built only from numbers parsed out of strict #RRGGBB matches (see brand-theme.ts), so it cannot carry markup or CSS injection -->
		{@html `<style data-org-brand>${css}<` + `/style>`}
	{/if}
</svelte:head>
