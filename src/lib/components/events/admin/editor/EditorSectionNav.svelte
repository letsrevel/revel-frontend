<script lang="ts" module>
	export interface NavSection {
		id: string;
		label: string;
		hasError?: boolean;
	}

	/** A sibling page (tab) of the editor, rendered as a button after the section links. */
	export interface NavTab {
		value: string;
		label: string;
		/** The tab currently shown; marked `aria-current="page"` and not a "goes elsewhere" link. */
		current?: boolean;
		/** Show an error dot (e.g. Details while validation blocks a save from another tab). */
		hasError?: boolean;
	}
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { ChevronRight } from '@lucide/svelte';

	interface Props {
		sections: NavSection[];
		/** `list`: vertical list (rail). `chips`: horizontally scrolling row (< xl). */
		variant: 'list' | 'chips';
		/** Other editor tabs (ticketed events). Selecting one calls `onTab`. */
		tabs?: NavTab[];
		onTab?: (value: string) => void;
		class?: string;
	}

	const { sections, variant, tabs = [], onTab, class: className }: Props = $props();

	let activeId = $state<string | null>(null);
	// Set by a nav click: the clicked section stays active (a short section near the
	// page end can never reach the 30% line, and the at-bottom rule would otherwise
	// hand the highlight to the last section) until the user scrolls by hand again.
	let lockedId: string | null = null;

	function prefersReducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function handleClick(event: MouseEvent, id: string): void {
		const target = document.getElementById(id);
		if (!target) return;
		event.preventDefault();
		target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
		// Move focus with the viewport so keyboard / screen-reader users land in the section.
		target.focus({ preventScroll: true });
		lockedId = id;
		activeId = id;
	}

	// Scroll-spy: the active section is the last one (document order) whose top
	// has crossed 30% of the viewport, falling back to the first section; at the
	// bottom of the page the last section wins even if it is too short to cross.
	// (An IntersectionObserver band left the highlight stale whenever no section
	// crossed it, e.g. at scroll 0 where Basics still sits below the band.)
	$effect(() => {
		const ids = sections.map((s) => s.id);
		let frame = 0;

		function update(): void {
			frame = 0;
			if (lockedId) return;
			const elements = ids
				.map((id) => document.getElementById(id))
				.filter((el): el is HTMLElement => el !== null);
			if (elements.length === 0) return;
			const scrollable = document.documentElement.scrollHeight > window.innerHeight + 2;
			const atBottom =
				scrollable &&
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			if (atBottom) {
				activeId = elements[elements.length - 1].id;
				return;
			}
			const threshold = window.innerHeight * 0.3;
			let current = elements[0].id;
			for (const el of elements) {
				if (el.getBoundingClientRect().top <= threshold) current = el.id;
			}
			activeId = current;
		}

		function schedule(): void {
			if (!frame) frame = requestAnimationFrame(update);
		}

		// Manual scroll intent releases the click lock.
		function release(): void {
			if (!lockedId) return;
			lockedId = null;
			schedule();
		}

		update();
		window.addEventListener('wheel', release, { passive: true });
		window.addEventListener('touchmove', release, { passive: true });
		window.addEventListener('keydown', release);
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('wheel', release);
			window.removeEventListener('touchmove', release);
			window.removeEventListener('keydown', release);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});
</script>

<nav aria-label={m['eventEditor.navLabel']()} class={className}>
	<ul class={cn(variant === 'chips' ? 'flex gap-2 overflow-x-auto pb-1' : 'flex flex-col gap-0.5')}>
		{#each sections as section (section.id)}
			<li class={variant === 'chips' ? 'shrink-0' : undefined}>
				<a
					href="#{section.id}"
					aria-current={activeId === section.id ? 'location' : undefined}
					onclick={(e) => handleClick(e, section.id)}
					class={cn(
						'inline-flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						variant === 'chips'
							? 'whitespace-nowrap rounded-full border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground aria-[current=location]:border-primary aria-[current=location]:bg-primary/10'
							: 'w-full rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=location]:bg-muted aria-[current=location]:font-semibold aria-[current=location]:text-foreground'
					)}
				>
					{section.label}
					{#if section.hasError}
						<span class="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
						<span class="sr-only">{m['eventEditor.navHasErrors']()}</span>
					{/if}
				</a>
			</li>
		{/each}
		{#if tabs.length > 0}
			{#if sections.length > 0}
				<li
					role="separator"
					class={variant === 'chips'
						? 'my-1 w-px shrink-0 self-stretch bg-border'
						: 'my-2 border-t border-border'}
				></li>
			{/if}
			{#each tabs as tab (tab.value)}
				<li class={variant === 'chips' ? 'shrink-0' : undefined}>
					<button
						type="button"
						aria-current={tab.current ? 'page' : undefined}
						onclick={() => onTab?.(tab.value)}
						class={cn(
							'inline-flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							variant === 'chips'
								? 'whitespace-nowrap rounded-full border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary/10'
								: 'w-full justify-between rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground'
						)}
					>
						<span class="inline-flex items-center gap-2">
							{tab.label}
							{#if tab.hasError}
								<span class="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden="true"
								></span>
								<span class="sr-only">{m['eventEditor.navHasErrors']()}</span>
							{/if}
						</span>
						{#if !tab.current}
							<ChevronRight class="h-4 w-4 shrink-0" aria-hidden="true" />
						{/if}
					</button>
				</li>
			{/each}
		{/if}
	</ul>
</nav>
