<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog as DialogPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { DialogPortal, DialogOverlay } from '$lib/components/ui/dialog';
	import { cn } from '$lib/utils';

	/**
	 * A side panel built on the dialog primitive (modal, focus-trapped, Escape and
	 * outside-click close, focus returns to the element that opened it). Full
	 * screen below `sm`, a right-hand panel from `sm` up.
	 */
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		children: Snippet;
	} = $props();
</script>

<DialogPortal>
	<DialogOverlay />
	<DialogPrimitive.Content
		bind:ref
		class={cn(
			'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-4 overflow-y-auto border-l-2 bg-background p-6 shadow-poster-lg duration-300 sm:max-w-xl',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		<DialogPrimitive.Close
			class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
		>
			<X class="size-4" aria-hidden="true" />
			<span class="sr-only">{m['dialogContent.close']()}</span>
		</DialogPrimitive.Close>
	</DialogPrimitive.Content>
</DialogPortal>
