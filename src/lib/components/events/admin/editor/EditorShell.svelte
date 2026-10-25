<script lang="ts">
	import type { Snippet } from 'svelte';
	import SaveBar from '../SaveBar.svelte';
	import EditorSectionNav, { type NavSection } from './EditorSectionNav.svelte';

	interface Props {
		main: Snippet;
		/** The event glance card; rendered once per breakpoint (compact on top < xl, in the rail on xl). */
		glance: Snippet;
		sections: NavSection[];
		showNav: boolean;
		/** Render the save buttons at the foot of the rail (xl). */
		railSave: boolean;
		isSaving: boolean;
		isDirty: boolean;
		onSave: () => void;
		onSaveAndExit: () => void;
	}

	const {
		main,
		glance,
		sections,
		showNav,
		railSave,
		isSaving,
		isDirty,
		onSave,
		onSaveAndExit
	}: Props = $props();
</script>

<!-- Two-column shell: main column + sticky rail on xl; one column below.
     The rail is an <aside> AFTER main in DOM (supplementary content). Below xl
     the glance card renders at the top of the main column and the section nav
     becomes a chip row; the rail is display:none there, so nothing is read twice. -->
<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
	<div class="min-w-0 space-y-6">
		{#if showNav}
			<EditorSectionNav {sections} variant="chips" class="xl:hidden" />
		{/if}
		<div class="xl:hidden">{@render glance()}</div>
		{@render main()}
	</div>
	<aside
		class="hidden space-y-6 xl:sticky xl:block xl:self-start"
		style="top: calc(var(--admin-sticky-top) + 1.5rem)"
	>
		{@render glance()}
		{#if showNav}
			<EditorSectionNav {sections} variant="list" />
		{/if}
		{#if railSave}
			<div class="border-t border-border pt-4">
				<SaveBar variant="rail" {isSaving} {isDirty} {onSave} {onSaveAndExit} />
			</div>
		{/if}
	</aside>
</div>
