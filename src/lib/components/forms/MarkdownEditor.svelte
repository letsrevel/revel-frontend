<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Editor } from '@tiptap/core';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import EditorToolbar from './editor/EditorToolbar.svelte';

	interface Props {
		value?: string;
		id?: string;
		label?: string;
		placeholder?: string;
		rows?: number;
		required?: boolean;
		disabled?: boolean;
		error?: string;
		class?: string;
		onValueChange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		id,
		label,
		placeholder = m['markdownEditor.placeholderDefault'](),
		rows = 6,
		required = false,
		disabled = false,
		error,
		class: className,
		onValueChange
	}: Props = $props();

	const inputId = $derived(id || `markdown-${Math.random().toString(36).slice(2, 11)}`);

	let editor = $state<Editor | undefined>();
	let element = $state<HTMLDivElement | undefined>();
	let sourceMode = $state(false);

	// Echo-loop guard: track the markdown we last emitted so external value
	// changes (≠ our own output) re-sync the editor, but our own edits don't.
	let lastEmitted = '';

	function emit(next: string): void {
		lastEmitted = next;
		value = next;
		onValueChange?.(next);
	}

	onMount(() => {
		if (!browser || !element) return;
		let active = true;
		let ed: Editor | undefined;
		(async () => {
			const { Editor } = await import('@tiptap/core');
			const { createEditorExtensions } = await import('./editor/tiptap-config');
			if (!active || !element) return;
			ed = new Editor({
				element,
				injectCSS: false, // CSP: no runtime <style>
				editable: !disabled,
				extensions: createEditorExtensions(),
				onCreate: ({ editor: e }) => {
					// Suppress the update event so mounting doesn't mark pristine forms dirty
					e.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
					lastEmitted = value;
					// Apply dynamic height via CSSOM (CSP-safe; inline style= attr is blocked by nonce policy)
					if (element) {
						element.style.setProperty('--editor-min-h', `${rows * 1.5}rem`);
					}
				},
				onUpdate: ({ editor: e }) => emit(e.getMarkdown())
			});
			editor = ed;
		})();
		return () => {
			active = false;
			ed?.destroy();
		};
	});

	// External value changes → re-sync editor (guarded against our own emits)
	$effect(() => {
		const v = value;
		if (editor && v !== lastEmitted && !sourceMode) {
			lastEmitted = v;
			editor.commands.setContent(v, { contentType: 'markdown' });
		}
	});

	// Reflect disabled into the live editor (emitUpdate=false: no spurious update event on mount)
	$effect(() => {
		editor?.setEditable(!disabled, false);
	});

	function handleSourceInput(e: Event): void {
		emit((e.target as HTMLTextAreaElement).value);
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{label}
			{#if required}<span class="text-destructive" aria-label={m['markdownEditor.required']()}
					>*</span
				>{/if}
		</label>
	{/if}

	{#if editor && !sourceMode}
		<EditorToolbar {editor} {disabled} onToggleSource={() => (sourceMode = true)} />
	{/if}

	{#if browser && !sourceMode}
		<!-- WYSIWYG surface; hidden until enhanced, falls back to textarea below -->
		<div
			bind:this={element}
			class={cn(
				'markdown-editor-surface prose prose-sm max-w-none rounded-md border-2 px-3 py-2 dark:prose-invert',
				'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary',
				error ? 'border-destructive' : 'border-gray-300 dark:border-gray-600',
				disabled && 'cursor-not-allowed opacity-50'
			)}
			aria-label={label}
			aria-invalid={!!error}
			aria-describedby={error ? `${inputId}-error` : undefined}
			class:hidden={!editor}
		></div>
	{/if}

	{#if !editor || sourceMode}
		<!-- SSR / no-JS / source-mode fallback -->
		<textarea
			id={inputId}
			name={inputId}
			bind:value
			oninput={handleSourceInput}
			{placeholder}
			{rows}
			{required}
			{disabled}
			aria-invalid={!!error}
			aria-describedby={error ? `${inputId}-error` : undefined}
			class={cn(
				'w-full resize-y rounded-md border-2 px-3 py-2 text-sm',
				'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
				'placeholder:text-muted-foreground',
				'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				error ? 'border-destructive' : 'border-gray-300 dark:border-gray-600'
			)}
		></textarea>
		{#if sourceMode && editor}
			<button
				type="button"
				class="text-sm text-muted-foreground underline"
				onclick={() => (sourceMode = false)}
			>
				{m['markdownEditor.exitSource']()}
			</button>
		{/if}
	{/if}

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">{error}</p>
	{/if}
</div>
