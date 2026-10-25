<script lang="ts">
	import type { Snippet } from 'svelte';
	import SaveBar from '../SaveBar.svelte';
	import EditorSectionNav, { type NavSection, type NavTab } from './EditorSectionNav.svelte';

	interface Props {
		main: Snippet;
		/** The event glance card; rendered once per breakpoint (compact on top < xl, in the rail on xl). */
		glance: Snippet;
		sections: NavSection[];
		showNav: boolean;
		/** Sibling editor tabs shown in the nav after the section links. */
		navTabs?: NavTab[];
		onNavTab?: (value: string) => void;
		/** Render the save buttons at the foot of the rail (xl). */
		railSave: boolean;
		isSaving: boolean;
		isDirty: boolean;
		onSave?: () => void;
		onSaveAndExit?: () => void;
		/** `create`: the rail shows Cancel / Create Event, submitting the form named by `formId`. */
		saveMode?: 'edit' | 'create';
		formId?: string;
	}

	const {
		main,
		glance,
		sections,
		showNav,
		navTabs = [],
		onNavTab,
		railSave,
		isSaving,
		isDirty,
		onSave,
		onSaveAndExit,
		saveMode = 'edit',
		formId
	}: Props = $props();
</script>

<!-- Two-column shell: main column + sticky rail on xl; one column below.
     The rail is an <aside> AFTER main in DOM (supplementary content). Below xl
     the glance card renders at the top of the main column and the section nav
     becomes a chip row; the rail is display:none there, so nothing is read twice. -->
<div class="grid gap-8 xl:grid-cols-[minmax(0,48rem)_18rem]">
	<!-- flex + gap (not space-y): a display:none sibling must not leave a margin behind it -->
	<div class="flex min-w-0 flex-col gap-6 pb-4 xl:pb-0">
		{#if showNav}
			<EditorSectionNav
				{sections}
				variant="chips"
				tabs={navTabs}
				onTab={onNavTab}
				class="xl:hidden"
			/>
		{/if}
		<div class="xl:hidden">{@render glance()}</div>
		{@render main()}
	</div>
	<aside
		class="hidden xl:sticky xl:flex xl:max-h-[calc(100dvh-var(--admin-sticky-top)-3rem)] xl:flex-col xl:self-start"
		style="top: calc(var(--admin-sticky-top) + 1.5rem)"
	>
		<!-- Glance + nav scroll when the viewport is short; the save block below never leaves the screen. -->
		<div class="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-1">
			{@render glance()}
			{#if showNav}
				<EditorSectionNav {sections} variant="list" tabs={navTabs} onTab={onNavTab} />
			{/if}
		</div>
		{#if railSave}
			<div class="mt-6 shrink-0 border-t border-border pt-4">
				<SaveBar
					variant="rail"
					mode={saveMode}
					{formId}
					{isSaving}
					{isDirty}
					{onSave}
					{onSaveAndExit}
				/>
			</div>
		{/if}
	</aside>
</div>
