<script lang="ts">
	// STUB — replaced in full by Task 3.
	// Accepts the full prop contract so MarkdownEditor.svelte compiles.
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor;
		disabled?: boolean;
		onToggleSource: () => void;
		onInsertLink?: () => void;
	}

	let { disabled = false, onToggleSource }: Props = $props();
</script>

<div role="toolbar" aria-label="Editor toolbar">
	<button type="button" {disabled} onclick={onToggleSource}>Source</button>
</div>
