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

	let url = $state('');
	let text = $state('');
	let invalid = $state(false);

	// Reset fields each time the dialog opens, reading initial values without
	// subscribing to them (they only matter at open-time).
	$effect(() => {
		if (open) {
			url = untrack(() => initialUrl);
			text = untrack(() => initialText);
			invalid = false;
		}
	});

	function apply(): void {
		if (!isAllowedLinkScheme(url)) {
			invalid = true;
			return;
		}
		onApply({ url: url.trim(), text: text.trim() || url.trim() });
		open = false;
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (!o) onClose(); }}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['markdownEditor.linkDialogTitle']()}</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-3">
			<label class="block text-sm font-medium" for="link-url"
				>{m['markdownEditor.linkUrlLabel']()}</label
			>
			<input
				id="link-url"
				bind:value={url}
				class="w-full rounded-md border-2 px-3 py-2 text-sm"
				placeholder="https://"
				aria-invalid={invalid}
			/>
			<label class="block text-sm font-medium" for="link-text"
				>{m['markdownEditor.linkTextLabel']()}</label
			>
			<input id="link-text" bind:value={text} class="w-full rounded-md border-2 px-3 py-2 text-sm" />
			{#if invalid}
				<p class="text-sm text-destructive" role="alert">{m['markdownEditor.linkSchemeError']()}</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					open = false;
					onClose();
				}}>{m['markdownEditor.cancel']()}</Button
			>
			<Button onclick={apply}>{m['markdownEditor.linkApply']()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
