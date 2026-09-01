<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Save, Loader2 } from '@lucide/svelte';

	interface Props {
		isSaving: boolean;
		onSave: () => void;
		onSaveAndExit: () => void;
		position: 'top' | 'bottom';
		disabled?: boolean;
	}

	const { isSaving, onSave, onSaveAndExit, position, disabled = false }: Props = $props();
</script>

<!--
	The top bar pins below the global site header: the org-admin layout
	publishes `--admin-sticky-top` as that navbar's height (both EventEditor
	call sites are admin routes, so it is always in scope). The org-admin
	header block itself no longer sticks (unstuck 2026-08-13 — it used to eat
	a third of a laptop screen), so this bar's own offset only ever needs to
	clear the site header above it. `tall:` because on a landscape phone the
	site header plus this bar left no room to scroll. The inset is set only
	for `top` — giving a `bottom-0` sticky a `top` too would re-pin it to the
	top edge.

	The bottom bar deliberately stays sticky at EVERY viewport height: the
	landscape bug was the stacked, offset-dependent top chrome, while this is a
	single ~56px row with no offset arithmetic, and it is the only save
	affordance on a long form — unsticking it would make a landscape-phone user
	scroll to the form's end to save.
-->
<div
	class={cn(
		'z-20 border-border bg-background/80 px-4 py-3 backdrop-blur-sm',
		position === 'top' && 'border-b tall:sticky',
		position === 'bottom' && 'sticky bottom-0 border-t'
	)}
	style={position === 'top' ? 'top: var(--admin-sticky-top)' : undefined}
>
	<div class="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:justify-end">
		<button
			type="button"
			onclick={onSaveAndExit}
			disabled={isSaving || disabled}
			class={cn(
				'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				(isSaving || disabled) && 'cursor-not-allowed opacity-50'
			)}
		>
			<Save class="h-4 w-4" aria-hidden="true" />
			{isSaving ? m['eventEditor.saving']() : m['eventEditor.saveAndExit']()}
		</button>
		<button
			type="button"
			onclick={onSave}
			disabled={isSaving || disabled}
			class={cn(
				'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				(isSaving || disabled) && 'cursor-not-allowed opacity-50'
			)}
		>
			{#if isSaving}
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['eventEditor.saving']()}
			{:else}
				<Save class="h-4 w-4" aria-hidden="true" />
				{m['eventEditor.save']()}
			{/if}
		</button>
	</div>
</div>
