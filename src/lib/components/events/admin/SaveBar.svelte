<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Save, Loader2 } from 'lucide-svelte';

	interface Props {
		isSaving: boolean;
		onSave: () => void;
		onSaveAndExit: () => void;
		position: 'top' | 'bottom';
		disabled?: boolean;
	}

	let { isSaving, onSave, onSaveAndExit, position, disabled = false }: Props = $props();
</script>

<div
	class={cn(
		'z-20 border-border bg-background/80 px-4 py-3 backdrop-blur-sm',
		position === 'top' && 'sticky top-[8rem] border-b',
		position === 'bottom' && 'sticky bottom-0 border-t'
	)}
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
