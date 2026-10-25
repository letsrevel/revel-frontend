<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Save, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		isSaving: boolean;
		onSave?: () => void;
		onSaveAndExit?: () => void;
		/** `bar`: sticky bottom bar (< xl). `rail`: stacked block at the foot of the xl rail. */
		variant: 'bar' | 'rail';
		/**
		 * `edit`: Save / Save & Exit with an unsaved-changes status.
		 * `create`: Cancel / Create Event, the latter submitting the form named by `formId`.
		 */
		mode?: 'edit' | 'create';
		/** The create form's id, so the submit button can live outside the `<form>`. */
		formId?: string;
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
		mode = 'edit',
		formId,
		isDirty = false,
		disabled = false,
		class: className
	}: Props = $props();

	const isBar = $derived(variant === 'bar');
</script>

<!--
	The editor renders ONE save surface per viewport: the rail variant on xl+,
	this sticky bottom bar below it. Callers hide the other with `hidden xl:block`
	/ `xl:hidden` (display:none leaves the a11y tree), so there is never a second
	"Save" button for `getByRole` to trip over.

	The bar is ONE row (status left, buttons right) so it never eats more than
	~56px of a phone screen, and stays sticky at EVERY viewport height: it is the
	only save affordance on a long form.
-->
{#snippet status()}
	<p
		role="status"
		class={cn(
			'flex min-w-0 items-center gap-2 text-sm',
			isDirty ? 'font-medium text-foreground' : 'text-muted-foreground'
		)}
	>
		{#if isDirty}
			<span class="h-2 w-2 shrink-0 rounded-full bg-highlight" aria-hidden="true"></span>
			<span class={cn(isBar && 'truncate')}>{m['eventEditor.unsavedChanges']()}</span>
		{:else}
			<span class={cn(isBar && 'truncate')}>{m['eventEditor.allSaved']()}</span>
		{/if}
	</p>
{/snippet}

{#snippet editButtons()}
	<Button
		variant="outline"
		size={isBar ? 'sm' : 'default'}
		onclick={onSaveAndExit}
		disabled={isSaving || disabled}
		class="font-semibold"
	>
		{#if !isBar}<Save aria-hidden="true" />{/if}
		{isSaving ? m['eventEditor.saving']() : m['eventEditor.saveAndExit']()}
	</Button>
	<Button
		size={isBar ? 'sm' : 'default'}
		onclick={onSave}
		disabled={isSaving || disabled}
		class="font-semibold"
	>
		{#if isSaving}
			<Loader2 class="animate-spin" aria-hidden="true" />
			{m['eventEditor.saving']()}
		{:else}
			{#if !isBar}<Save aria-hidden="true" />{/if}
			{m['eventEditor.save']()}
		{/if}
	</Button>
{/snippet}

{#snippet createButtons()}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- relative parent navigation (..); resolves against the mounting route, not a static route id -->
	<Button variant="outline" size={isBar ? 'sm' : 'default'} href=".." class="font-semibold">
		{m['essentialsStep.cancel']()}
	</Button>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<Button
		type="submit"
		form={formId}
		size={isBar ? 'sm' : 'default'}
		disabled={isSaving || disabled}
		class="font-semibold"
	>
		{isSaving ? m['essentialsStep.creatingEvent']() : m['essentialsStep.createEvent']()}
	</Button>
{/snippet}

{#if isBar}
	<div
		class={cn(
			'sticky bottom-0 z-20 border-t border-border bg-background/80 px-4 pt-3 backdrop-blur-sm',
			'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
			className
		)}
	>
		<div class="flex items-center justify-between gap-3">
			{#if mode === 'edit'}
				{@render status()}
			{/if}
			<div class={cn('flex shrink-0 gap-2', mode === 'create' && 'ml-auto')}>
				{#if mode === 'edit'}{@render editButtons()}{:else}{@render createButtons()}{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="space-y-3">
		{#if mode === 'edit'}
			{@render status()}
		{/if}
		<div class={cn('flex gap-2', mode === 'create' ? 'flex-col-reverse' : 'flex-col')}>
			{#if mode === 'edit'}{@render editButtons()}{:else}{@render createButtons()}{/if}
		</div>
	</div>
{/if}
