import { onDestroy } from 'svelte';
import * as m from '$lib/paraglide/messages.js';

export interface ConfirmRequest {
	/** Defaults to the generic "Confirm action?" title. */
	title?: string;
	message: string;
	/** Defaults to the generic "Confirm" label. */
	confirmLabel?: string;
	/** Renders the danger variant (destructive operations). */
	destructive?: boolean;
}

/** Props `createConfirm` produces for `<ConfirmDialog {...confirm.dialogProps} />`. */
export interface ConfirmDialogBindings {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText: string | undefined;
	variant: 'danger' | 'warning';
	confirmDisabled: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** The controller returned by `createConfirm`. */
export interface Confirm {
	ask(request: ConfirmRequest): Promise<boolean>;
	/** Whether a question is currently awaiting an answer. */
	readonly isOpen: boolean;
	/** Spread onto `<ConfirmDialog {...confirm.dialogProps} />`. */
	readonly dialogProps: ConfirmDialogBindings;
}

/**
 * Promise-based in-app replacement for `window.confirm()`.
 *
 * Create ONE per page (or per list owner) during component init and render a
 * single dialog bound to it:
 *
 * ```svelte
 * const confirm = createConfirm();
 * if (await confirm.ask({ message, destructive: true })) doIt();
 * ...
 * <ConfirmDialog {...confirm.dialogProps} />
 * ```
 *
 * Guarantees:
 * - the promise settles exactly once (a double click during the dialog's exit
 *   animation cannot fire the action twice; the Confirm button is also
 *   disabled as soon as the dialog starts closing);
 * - a second `ask()` while one is open settles the first as `false`;
 * - unmounting the owner settles a pending ask as `false`.
 *
 * Must be called during component initialisation (it registers the unmount
 * cleanup via `onDestroy`).
 */
export function createConfirm(): Confirm {
	// Last request, retained while the dialog animates out so its text does not
	// blank mid-fade.
	let request = $state<ConfirmRequest>({ message: '' });
	let open = $state(false);
	let resolver: ((ok: boolean) => void) | null = null;

	function settle(ok: boolean): void {
		const resolve = resolver;
		resolver = null;
		open = false;
		resolve?.(ok);
	}

	function ask(next: ConfirmRequest): Promise<boolean> {
		// A newer question supersedes the pending one.
		settle(false);
		request = next;
		open = true;
		return new Promise<boolean>((resolve) => {
			resolver = resolve;
		});
	}

	onDestroy(() => settle(false));

	return {
		ask,
		/** Whether a question is currently awaiting an answer. */
		get isOpen(): boolean {
			return open;
		},
		/** Spread onto `<ConfirmDialog {...confirm.dialogProps} />`. */
		get dialogProps(): ConfirmDialogBindings {
			return {
				isOpen: open,
				title: request.title ?? m['confirmDialog.title'](),
				message: request.message,
				confirmText: request.confirmLabel,
				variant: request.destructive ? 'danger' : 'warning',
				// Disabled the instant the promise settles, i.e. for the whole exit
				// animation, so a second click can never re-fire.
				confirmDisabled: !open,
				onConfirm: () => settle(true),
				onCancel: () => settle(false)
			};
		}
	};
}
