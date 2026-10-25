<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Save, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		isSaving: boolean;
		onSave: () => void;
		onSaveAndExit: () => void;
		/** `bar`: sticky bottom bar (< xl). `rail`: stacked block at the foot of the xl rail. */
		variant: 'bar' | 'rail';
		/** True when the editor holds changes that have not been saved. */
		isDirty?: boolean;
		disabled?: boolean;
		class?: string;
	}

	const {
		isSaving,
		onSave,
		onSaveAndExit,
		variant,
		isDirty = false,
		disabled = false,
		class: className
	}: Props = $props();
</script>

<!--
	The editor renders ONE save surface per viewport: the rail variant on xl+,
	this sticky bottom bar below it. Callers hide the other with `hidden xl:block`
	/ `xl:hidden` (display:none leaves the a11y tree), so there is never a second
	"Save" button for `getByRole` to trip over.

	The bar deliberately stays sticky at EVERY viewport height: it is a single
	~56px row with no offset arithmetic, and the only save affordance on a long
	form — unsticking it would make a landscape-phone user scroll to the form's
	end to save.
-->
{#snippet status()}
	<p
		role="status"
		class={cn(
			'flex items-center gap-2 text-sm',
			isDirty ? 'font-medium text-foreground' : 'text-muted-foreground'
		)}
	>
		{#if isDirty}
			<span class="h-2 w-2 shrink-0 rounded-full bg-highlight" aria-hidden="true"></span>
			{m['eventEditor.unsavedChanges']()}
		{:else}
			{m['eventEditor.allSaved']()}
		{/if}
	</p>
{/snippet}

{#snippet buttons()}
	<Button
		variant="outline"
		onclick={onSaveAndExit}
		disabled={isSaving || disabled}
		class="font-semibold"
	>
		<Save aria-hidden="true" />
		{isSaving ? m['eventEditor.saving']() : m['eventEditor.saveAndExit']()}
	</Button>
	<Button onclick={onSave} disabled={isSaving || disabled} class="font-semibold">
		{#if isSaving}
			<Loader2 class="animate-spin" aria-hidden="true" />
			{m['eventEditor.saving']()}
		{:else}
			<Save aria-hidden="true" />
			{m['eventEditor.save']()}
		{/if}
	</Button>
{/snippet}

{#if variant === 'bar'}
	<div
		class={cn(
			'sticky bottom-0 z-20 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-sm',
			className
		)}
	>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			{@render status()}
			<div class="flex flex-col gap-2 sm:flex-row">{@render buttons()}</div>
		</div>
	</div>
{:else}
	<div class="space-y-3">
		{@render status()}
		<div class="flex flex-col gap-2">{@render buttons()}</div>
	</div>
{/if}
