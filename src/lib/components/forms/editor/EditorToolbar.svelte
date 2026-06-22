<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		Bold,
		Italic,
		Strikethrough,
		Link as LinkIcon,
		Heading1,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		Quote,
		Code,
		SquareCode,
		FileCode2
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		editor: Editor;
		disabled?: boolean;
		onToggleSource: () => void;
		onInsertLink: () => void;
	}
	const { editor, disabled = false, onToggleSource, onInsertLink }: Props = $props();

	type Cmd = {
		key: string;
		label: string;
		icon: typeof Bold;
		isActive: () => boolean;
		run: () => void;
	};

	// State
	// Re-render active states on every editor transaction.
	let tick = $state(0);
	// Roving tabindex: index of the currently focusable button.
	let focusIndex = $state(0);
	// Total button count = commands + link + source
	const EXTRA_BUTTONS = 2;
	// Reference the toolbar element to find buttons for focus management.
	let toolbarEl = $state<HTMLDivElement | undefined>(undefined);

	// Derived
	const commands = $derived.by<Cmd[]>(() => {
		// Reference tick so the derived recomputes on every transaction.
		void tick;
		return [
			{
				key: 'bold',
				label: m['markdownEditor.bold'](),
				icon: Bold,
				isActive: () => editor.isActive('bold'),
				run: () => editor.chain().focus().toggleBold().run()
			},
			{
				key: 'italic',
				label: m['markdownEditor.italic'](),
				icon: Italic,
				isActive: () => editor.isActive('italic'),
				run: () => editor.chain().focus().toggleItalic().run()
			},
			{
				key: 'strike',
				label: m['markdownEditor.strikethrough'](),
				icon: Strikethrough,
				isActive: () => editor.isActive('strike'),
				run: () => editor.chain().focus().toggleStrike().run()
			},
			{
				key: 'h1',
				label: m['markdownEditor.heading1'](),
				icon: Heading1,
				isActive: () => editor.isActive('heading', { level: 1 }),
				run: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
			},
			{
				key: 'h2',
				label: m['markdownEditor.heading2'](),
				icon: Heading2,
				isActive: () => editor.isActive('heading', { level: 2 }),
				run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
			},
			{
				key: 'h3',
				label: m['markdownEditor.heading3'](),
				icon: Heading3,
				isActive: () => editor.isActive('heading', { level: 3 }),
				run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
			},
			{
				key: 'ul',
				label: m['markdownEditor.bulletList'](),
				icon: List,
				isActive: () => editor.isActive('bulletList'),
				run: () => editor.chain().focus().toggleBulletList().run()
			},
			{
				key: 'ol',
				label: m['markdownEditor.orderedList'](),
				icon: ListOrdered,
				isActive: () => editor.isActive('orderedList'),
				run: () => editor.chain().focus().toggleOrderedList().run()
			},
			{
				key: 'quote',
				label: m['markdownEditor.blockquote'](),
				icon: Quote,
				isActive: () => editor.isActive('blockquote'),
				run: () => editor.chain().focus().toggleBlockquote().run()
			},
			{
				key: 'code',
				label: m['markdownEditor.inlineCode'](),
				icon: Code,
				isActive: () => editor.isActive('code'),
				run: () => editor.chain().focus().toggleCode().run()
			},
			{
				key: 'codeBlock',
				label: m['markdownEditor.codeBlock'](),
				icon: FileCode2,
				isActive: () => editor.isActive('codeBlock'),
				run: () => editor.chain().focus().toggleCodeBlock().run()
			}
		];
	});

	// Link button is at index commands.length; source is last.
	const linkIndex = $derived(commands.length);
	const sourceIndex = $derived(commands.length + EXTRA_BUTTONS - 1);

	// Functions
	function getButtons(): HTMLButtonElement[] {
		if (!toolbarEl) return [];
		return Array.from(toolbarEl.querySelectorAll('button'));
	}

	function onKeydown(e: KeyboardEvent): void {
		const btns = getButtons();
		const count = btns.length;
		if (count === 0) return;
		if (e.key === 'ArrowRight') {
			focusIndex = (focusIndex + 1) % count;
			btns[focusIndex]?.focus();
			e.preventDefault();
		} else if (e.key === 'ArrowLeft') {
			focusIndex = (focusIndex - 1 + count) % count;
			btns[focusIndex]?.focus();
			e.preventDefault();
		} else if (e.key === 'Home') {
			focusIndex = 0;
			btns[focusIndex]?.focus();
			e.preventDefault();
		} else if (e.key === 'End') {
			focusIndex = count - 1;
			btns[focusIndex]?.focus();
			e.preventDefault();
		}
	}

	// Effects
	$effect(() => {
		const bump = () => (tick += 1);
		editor.on('transaction', bump);
		return () => editor.off('transaction', bump);
	});
</script>

<div
	role="toolbar"
	aria-label={m['markdownEditor.toolbarAriaLabel']()}
	aria-disabled={disabled}
	tabindex="-1"
	bind:this={toolbarEl}
	onkeydown={onKeydown}
	class="flex flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-800"
>
	{#each commands as cmd, i (cmd.key)}
		<button
			type="button"
			tabindex={i === focusIndex ? 0 : -1}
			{disabled}
			aria-label={cmd.label}
			aria-pressed={cmd.isActive()}
			title={cmd.label}
			onclick={cmd.run}
			onfocus={() => (focusIndex = i)}
			class="rounded p-1.5 transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 aria-pressed:bg-primary/15 dark:hover:bg-gray-700"
		>
			<cmd.icon class="h-4 w-4" aria-hidden="true" />
		</button>
	{/each}

	<button
		type="button"
		tabindex={linkIndex === focusIndex ? 0 : -1}
		{disabled}
		aria-label={m['markdownEditor.insertLink']()}
		title={m['markdownEditor.insertLink']()}
		onclick={onInsertLink}
		onfocus={() => (focusIndex = linkIndex)}
		class="rounded p-1.5 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-gray-700"
	>
		<LinkIcon class="h-4 w-4" aria-hidden="true" />
	</button>

	<button
		type="button"
		tabindex={sourceIndex === focusIndex ? 0 : -1}
		{disabled}
		aria-label={m['markdownEditor.viewSource']()}
		title={m['markdownEditor.viewSource']()}
		onclick={onToggleSource}
		onfocus={() => (focusIndex = sourceIndex)}
		class="ml-auto rounded p-1.5 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-gray-700"
	>
		<SquareCode class="h-4 w-4" aria-hidden="true" />
	</button>
</div>
