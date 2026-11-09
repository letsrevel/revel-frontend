<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { AlertTriangle } from '@lucide/svelte';
	import { Dialog, DialogContent, DialogDescription, DialogTitle } from '$lib/components/ui/dialog';

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

	const {
		isOpen,
		title,
		message,
		confirmText = m['confirmDialog.confirm'](),
		cancelText = m['confirmDialog.cancel'](),
		variant = 'warning',
		onConfirm,
		onCancel,
		class: className
	}: Props = $props();

	let cancelButtonEl = $state<HTMLButtonElement | null>(null);

	/**
	 * Escape, the close button and an outside click all arrive here as
	 * `open = false`; every one of them is a cancel.
	 */
	function handleOpenChange(open: boolean) {
		if (!open) onCancel();
	}

	/**
	 * Start on the safe action (Cancel) so a stray Enter never confirms a
	 * destructive operation.
	 */
	function handleOpenAutoFocus(event: Event) {
		if (cancelButtonEl) {
			event.preventDefault();
			cancelButtonEl.focus();
		}
	}
</script>

<!--
  Confirm Dialog Component

  The shared in-app replacement for window.confirm(). Built on the Dialog
  primitive (bits-ui), so it gets a focus trap, Escape-to-cancel, focus return to
  the trigger, correct stacking when opened from inside another dialog, and
  aria-modal for free. Cancel receives initial focus.

  @component
  @example
  <ConfirmDialog
    isOpen={showDialog}
    title="Confirm Action"
    message="Are you sure you want to proceed?"
    variant="danger"
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
-->
<Dialog open={isOpen} onOpenChange={handleOpenChange}>
	<DialogContent
		class={cn('max-w-lg', className)}
		onOpenAutoFocus={handleOpenAutoFocus}
		data-testid="confirm-dialog"
	>
		<div class="flex items-start gap-4 pr-6">
			<div
				class={cn(
					'shrink-0 rounded-full bg-muted p-3',
					variant === 'danger' ? 'text-destructive' : 'text-foreground'
				)}
				aria-hidden="true"
			>
				<AlertTriangle class="h-6 w-6" />
			</div>
			<div class="flex-1 pt-1">
				<DialogTitle class="text-lg font-semibold text-foreground">{title}</DialogTitle>
			</div>
		</div>

		<DialogDescription class="whitespace-pre-line text-sm text-muted-foreground">
			{message}
		</DialogDescription>

		<div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
			<button
				bind:this={cancelButtonEl}
				type="button"
				onclick={onCancel}
				data-testid="confirm-dialog-cancel"
				class="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{cancelText}
			</button>
			<button
				type="button"
				onclick={onConfirm}
				data-testid="confirm-dialog-confirm"
				class={cn(
					'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
					variant === 'warning' &&
						'bg-highlight text-highlight-foreground hover:bg-highlight/90 focus-visible:ring-highlight',
					variant === 'danger' &&
						'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
					variant === 'info' &&
						'bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-info'
				)}
			>
				{confirmText}
			</button>
		</div>
	</DialogContent>
</Dialog>
