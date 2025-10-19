<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { AlertTriangle, X } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		isOpen: boolean;
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'warning' | 'danger' | 'info';
		onConfirm: () => void;
		onCancel: () => void;
		class?: string;
	}

	let {
		isOpen,
		title,
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'warning',
		onConfirm,
		onCancel,
		class: className
	}: Props = $props();

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onCancel();
		}
	}

	/**
	 * Handle escape key
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onCancel();
		}
	}

	/**
	 * Trap focus within dialog when open
	 */
	$effect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<!--
  Confirm Dialog Component

  A reusable confirmation dialog with backdrop, keyboard handling, and focus trap.

  @component
  @example
  <ConfirmDialog
    isOpen={showDialog}
    title="Confirm Action"
    message="Are you sure you want to proceed?"
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
-->
{#if isOpen}
	<div
		role="presentation"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby="dialog-description"
			class={cn(
				'relative mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg',
				className
			)}
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={onCancel}
				aria-label="Close dialog"
				class="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>

			<!-- Icon + Title -->
			<div class="flex items-start gap-4">
				<div
					class={cn(
						'shrink-0 rounded-full p-3',
						variant === 'warning' && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
						variant === 'danger' && 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
						variant === 'info' && 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
					)}
					aria-hidden="true"
				>
					<AlertTriangle class="h-6 w-6" />
				</div>

				<div class="flex-1 pt-1">
					<h2 id="dialog-title" class="text-lg font-semibold text-foreground">
						{title}
					</h2>
				</div>
			</div>

			<!-- Message -->
			<div id="dialog-description" class="mt-4 text-sm text-muted-foreground">
				{message}
			</div>

			<!-- Actions -->
			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{cancelText}
				</button>
				<button
					type="button"
					onclick={onConfirm}
					class={cn(
						'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
						variant === 'warning' &&
							'bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-yellow-600 dark:bg-yellow-500 dark:hover:bg-yellow-600',
						variant === 'danger' &&
							'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 dark:bg-red-500 dark:hover:bg-red-600',
						variant === 'info' &&
							'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600'
					)}
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
