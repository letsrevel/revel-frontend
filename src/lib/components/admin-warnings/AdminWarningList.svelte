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
	 * dismiss, focus moves to the next callout's first control, else the previous
	 * one's, else to the list container (tabindex=-1, which stays mounted when the list is empty).
	 */
	interface Props {
		warnings: AdminWarning[];
		/** Saved entity id (event, tier, ...). Unset = unsaved: no dismiss buttons. */
		entityId?: string;
		class?: string;
		/** Debounce for announcements, in ms. */
		announceDelay?: number;
		testId?: string;
	}

	const {
		warnings,
		entityId,
		class: className,
		announceDelay = 500,
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
		if (!ready) return;
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
		await tick();
		const items = container?.querySelectorAll<HTMLLIElement>('li[data-admin-warning-item]');
		// The next callout (now at `index`), else the previous one, else the container.
		const item = items?.[index] ?? items?.[index - 1];
		const next = item?.querySelector<HTMLElement>('[data-admin-warning-control]');
		(next ?? container)?.focus();
	}
</script>

<div
	bind:this={container}
	tabindex="-1"
	class={cn(visible.length > 0 ? 'focus:outline-none' : 'sr-only', className)}
	data-testid={testId}
>
	{#if visible.length > 0}
		<ul class="space-y-2" aria-label={m['adminWarnings.listLabel']()}>
			{#each visible as warning, index (warning.id)}
				<li data-admin-warning-item>
					<AdminWarningCallout
						{warning}
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
