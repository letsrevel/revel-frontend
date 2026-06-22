<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Editor } from '@tiptap/core';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import EditorToolbar from './editor/EditorToolbar.svelte';
	import LinkDialog from './editor/LinkDialog.svelte';

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
	let linkOpen = $state(false);
	let linkInitial = $state({ url: '', text: '' });

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
				extensions: createEditorExtensions(placeholder),
				editorProps: {
					attributes: {
						'aria-multiline': 'true',
						...(label
							? { 'aria-labelledby': `${inputId}-label` }
							: { 'aria-label': placeholder || m['markdownEditor.placeholderDefault']() })
					}
				},
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

	// Keep the editor DOM's ARIA attributes in sync when label/error change after mount.
	$effect(() => {
		const dom = editor?.view?.dom as HTMLElement | undefined;
		if (!dom) return;
		dom.setAttribute('aria-multiline', 'true');
		if (label) {
			dom.setAttribute('aria-labelledby', `${inputId}-label`);
			dom.removeAttribute('aria-label');
		} else {
			dom.setAttribute('aria-label', placeholder || m['markdownEditor.placeholderDefault']());
			dom.removeAttribute('aria-labelledby');
		}
		if (error) {
			dom.setAttribute('aria-invalid', 'true');
			dom.setAttribute('aria-describedby', `${inputId}-error`);
		} else {
			dom.removeAttribute('aria-invalid');
			dom.removeAttribute('aria-describedby');
		}
	});

	function handleSourceInput(e: Event): void {
		emit((e.target as HTMLTextAreaElement).value);
	}

	function openLink(): void {
		const prev = editor?.getAttributes('link')?.href ?? '';
		const { from, to } = editor?.state.selection ?? { from: 0, to: 0 };
		const selected = editor?.state.doc.textBetween(from, to, ' ') ?? '';
		linkInitial = { url: prev, text: selected };
		linkOpen = true;
	}

	function exitSource(): void {
		sourceMode = false;
		if (editor) {
			// Force the external-sync $effect to re-run by temporarily clearing lastEmitted.
			// Without this, value === lastEmitted (set by emit() during source editing) so
			// the $effect guard skips the setContent and the WYSIWYG view shows stale content.
			lastEmitted = '';
			editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
			lastEmitted = value;
		}
	}

	function applyLink({ url, text }: { url: string; text: string }): void {
		if (!editor) return;
		const { from, to } = editor.state.selection;
		editor
			.chain()
			.focus()
			.insertContentAt({ from, to }, text)
			.setTextSelection({ from, to: from + text.length })
			.setLink({ href: url })
			.run();
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<label
			id="{inputId}-label"
			for={editor && !sourceMode ? undefined : inputId}
			class="block text-sm font-medium text-gray-900 dark:text-gray-100"
		>
			{label}
			{#if required}<span class="text-destructive" aria-label={m['markdownEditor.required']()}
					>*</span
				>{/if}
		</label>
	{/if}

	{#if editor && !sourceMode}
		<EditorToolbar {editor} {disabled} onToggleSource={() => (sourceMode = true)} onInsertLink={openLink} />
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
				class="text-sm text-muted-foreground underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
				onclick={exitSource}
			>
				{m['markdownEditor.exitSource']()}
			</button>
		{/if}
	{/if}

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if editor}
		<LinkDialog
			bind:open={linkOpen}
			initialUrl={linkInitial.url}
			initialText={linkInitial.text}
			onApply={applyLink}
			onClose={() => (linkOpen = false)}
		/>
	{/if}
</div>
