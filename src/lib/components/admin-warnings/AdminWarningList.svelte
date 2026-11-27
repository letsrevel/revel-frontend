<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import AdminWarningCallout from './AdminWarningCallout.svelte';
	import type { AdminWarning } from '$lib/utils/admin-warnings/types';
	import {
		dismissWarning,
		isWarningDismissed,
		loadDismissed
	} from '$lib/utils/admin-warnings/dismissed.svelte';

	/**
	 * A list of admin setting warnings (#1314).
	 *
	 * Live region: the visible callouts are NOT in a live region. A separate,
	 * always-mounted sr-only `role="status"` announces only the warnings that
	 * appear AFTER mount (debounced, so typing into a date field does not spam).
	 * Nothing is announced at first paint, for the post-mount dismissal filter,
	 * or when a warning goes away.
	 *
	 * Dismissal: only Info warnings of a saved entity (`entityId` set). After a
	 * dismiss or an in-place fix, focus moves to the nearest callout control
	 * (forward, then backward), else to `fallbackFocusId`, else to the list container (tabindex=-1, which stays mounted when the list is empty).
	 */
	interface Props {
		warnings: AdminWarning[];
		/** Saved entity id (event, tier, ...). Unset = unsaved: no dismiss buttons. */
		entityId?: string;
		class?: string;
		/** Debounce for announcements, in ms. */
		announceDelay?: number;
		/**
		 * False while the caller's data is still loading. The first-paint baseline is
		 * taken on the first run where this is true, so warnings that arrive with the
		 * data are not announced as "new".
		 */
		baselineReady?: boolean;
		/** Element id to focus when a dismiss or an in-place fix leaves no callout control. */
		fallbackFocusId?: string;
		/** Accessible name of the list. Defaults to "Setting warnings". */
		label?: string;
		testId?: string;
	}

	const {
		warnings,
		entityId,
		class: className,
		announceDelay = 500,
		baselineReady = true,
		fallbackFocusId,
		label,
		testId = 'admin-warning-list'
	}: Props = $props();

	const uid = $props.id();

	let ready = $state(false);
	let announcement = $state('');
	let container: HTMLDivElement | undefined = $state();

	const visible = $derived(
		warnings.filter(
			(w) => !(ready && entityId && w.level === 'info' && isWarningDismissed(entityId, w.id))
		)
	);

	onMount(() => {
		loadDismissed();
		ready = true;
	});

	// Ids shown on the previous run; plain (non-reactive) bookkeeping.
	let seen: Set<string> | null = null;
	let pending: string[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const ids = visible.map((w) => w.id);
		if (!ready || !baselineReady) return;
		if (seen === null) {
			// First run after mount (dismissal filter applied): the baseline, no announcement.
			seen = new Set(ids);
			return;
		}
		const previous = seen;
		seen = new Set(ids);
		const fresh = ids.filter((id) => !previous.has(id));
		if (fresh.length === 0) return;
		pending = [...pending, ...fresh];
		clearTimeout(timer);
		timer = setTimeout(flush, announceDelay);
	});

	async function flush(): Promise<void> {
		// Only the warnings that are still visible after the debounce.
		const text = visible
			.filter((w) => pending.includes(w.id))
			.map((w) => `${w.title()}. ${w.message()}`)
			.join(' ');
		pending = [];
		if (!text) return;
		// Clear first so the same text twice is announced again.
		announcement = '';
		await tick();
		announcement = text;
	}

	onDestroy(() => clearTimeout(timer));

	async function handleDismiss(warning: AdminWarning, index: number): Promise<void> {
		if (!entityId) return;
		dismissWarning(entityId, warning.id);
		await moveFocusAfterRemoval(index);
	}

	// An in-place fix (e.g. "Clear deadline") usually makes its own warning go away;
	// then focus moves on as after a dismiss, so keyboard users do not lose it.
	function withFocusHandoff(warning: AdminWarning, index: number): AdminWarning {
		const action = warning.action;
		if (!action) return warning;
		return {
			...warning,
			action: {
				label: action.label,
				srContext: action.srContext,
				run: async () => {
					await action.run();
					await tick();
					if (!visible.some((w) => w.id === warning.id)) await moveFocusAfterRemoval(index);
				}
			}
		};
	}

	// Editing surfaces first (a rich-text editor's toolbar comes before its surface in
	// the DOM), then any other focusable control. Roving-tabindex buttons (-1) are skipped.
	const SURFACES = 'textarea, [contenteditable="true"]';
	const CONTROLS =
		'input, select, button:not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"])';

	/** Disabled, or inside a hidden subtree (MarkdownEditor keeps its rich surface in a `.hidden` div in source mode). */
	function unusable(el: Element): boolean {
		return el.matches(':disabled') || el.closest('.hidden, [hidden], [inert]') !== null;
	}

	/** The element itself when it can take focus, else its first usable surface or control. */
	function focusableIn(el: HTMLElement | null): HTMLElement | null {
		if (!el) return null;
		const selfFocusable =
			el.matches(SURFACES) || el.matches(CONTROLS) || el.hasAttribute('tabindex');
		if (selfFocusable && !unusable(el)) return el;
		for (const selector of [SURFACES, CONTROLS]) {
			const found = Array.from(el.querySelectorAll<HTMLElement>(selector)).find(
				(c) => !unusable(c)
			);
			if (found) return found;
		}
		return null;
	}

	async function moveFocusAfterRemoval(index: number): Promise<void> {
		await tick();
		const items = Array.from(
			container?.querySelectorAll<HTMLLIElement>('li[data-admin-warning-item]') ?? []
		);
		const controlOf = (li: HTMLLIElement | undefined): HTMLElement | null =>
			li?.querySelector<HTMLElement>('[data-admin-warning-control]') ?? null;
		// The nearest control from `index` forward (the next callout now sits at
		// `index`), then backward; then the caller's field; the container last.
		let target: HTMLElement | null = null;
		for (let i = index; i < items.length && !target; i++) target = controlOf(items[i]);
		for (let i = index - 1; i >= 0 && !target; i--) target = controlOf(items[i]);
		target ??= fallbackFocusId ? focusableIn(document.getElementById(fallbackFocusId)) : null;
		target?.focus();
		// The target may refuse focus (e.g. hidden by CSS we cannot see): never strand it.
		if (!target || document.activeElement !== target) container?.focus();
	}
</script>

<div
	bind:this={container}
	tabindex="-1"
	class={cn(
		visible.length > 0
			? 'rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
			: 'sr-only',
		className
	)}
	data-testid={testId}
>
	{#if visible.length > 0}
		<!-- role="list": Tailwind preflight removes list styling, and WebKit/VoiceOver
		     then drops the list semantics (same convention as ScopeList). -->
		<ul role="list" class="space-y-2" aria-label={label ?? m['adminWarnings.listLabel']()}>
			{#each visible as warning, index (warning.id)}
				<li data-admin-warning-item>
					<AdminWarningCallout
						warning={withFocusHandoff(warning, index)}
						messageId="{uid}-{warning.id}"
						onDismiss={entityId && warning.level === 'info'
							? () => handleDismiss(warning, index)
							: undefined}
					/>
				</li>
			{/each}
		</ul>
	{/if}
	<div role="status" class="sr-only" data-testid="{testId}-announcer">{announcement}</div>
</div>
