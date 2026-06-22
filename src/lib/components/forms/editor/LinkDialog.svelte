<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages.js';
	import { isAllowedLinkScheme } from './tiptap-config';

	interface Props {
		open: boolean;
		initialUrl?: string;
		initialText?: string;
		onApply: (args: { url: string; text: string }) => void;
		onClose: () => void;
	}
	let {
		open = $bindable(false),
		initialUrl = '',
		initialText = '',
		onApply,
		onClose
	}: Props = $props();

	// Fix M2: unique prefix so multiple LinkDialog instances on the same page
	// don't produce duplicate HTML ids.
	const uid = `link-${Math.random().toString(36).slice(2, 11)}`;

	let url = $state('');
	let text = $state('');
	let invalid = $state(false);

	function apply(): void {
		if (!isAllowedLinkScheme(url)) {
			invalid = true;
			return;
		}
		onApply({ url: url.trim(), text: text.trim() || url.trim() });
		open = false;
	}

	// Reset fields each time the dialog opens, reading initial values without
	// subscribing to them (they only matter at open-time).
	$effect(() => {
		if (open) {
			url = untrack(() => initialUrl);
			text = untrack(() => initialText);
			invalid = false;
		}
	});
</script>

<!-- Fix M3: onOpenChange is the single source of onClose for ALL close paths
     (Escape, overlay click, programmatic `open = false` from apply()).
     Bits UI Dialog DOES fire onOpenChange when open is set programmatically,
     so the Cancel button only needs to set open = false; onClose fires once
     via onOpenChange for every path. -->
<Dialog.Root
	bind:open
	onOpenChange={(o) => {
		if (!o) onClose();
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['markdownEditor.linkDialogTitle']()}</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-3">
			<!-- Fix M2: unique id via uid prefix -->
			<label class="block text-sm font-medium" for="{uid}-url"
				>{m['markdownEditor.linkUrlLabel']()}</label
			>
			<!-- Fix M1: aria-describedby associates error with input -->
			<!-- Fix I1: aria-invalid as explicit string 'true' or omitted -->
			<input
				id="{uid}-url"
				bind:value={url}
				class="w-full rounded-md border-2 px-3 py-2 text-sm"
				placeholder="https://"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={invalid ? `${uid}-error` : undefined}
			/>
			<!-- Fix M2: unique id via uid prefix -->
			<label class="block text-sm font-medium" for="{uid}-text"
				>{m['markdownEditor.linkTextLabel']()}</label
			>
			<input
				id="{uid}-text"
				bind:value={text}
				class="w-full rounded-md border-2 px-3 py-2 text-sm"
			/>
			{#if invalid}
				<!-- Fix M1 + M2: unique id for error element -->
				<p id="{uid}-error" class="text-sm text-destructive" role="alert">
					{m['markdownEditor.linkSchemeError']()}
				</p>
			{/if}
		</div>
		<Dialog.Footer>
			<!-- Fix M3: Cancel only sets open = false; onClose fires via onOpenChange -->
			<Button variant="outline" onclick={() => (open = false)}>{m['common.cancel']()}</Button>
			<Button onclick={apply}>{m['markdownEditor.linkApply']()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
