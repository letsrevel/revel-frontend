<script lang="ts" module>
	export interface NavSection {
		id: string;
		label: string;
		hasError?: boolean;
	}
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';

	interface Props {
		sections: NavSection[];
		/** `list`: vertical list (rail). `chips`: horizontally scrolling row (< xl). */
		variant: 'list' | 'chips';
		class?: string;
	}

	const { sections, variant, class: className }: Props = $props();

	let activeId = $state<string | null>(null);

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
		activeId = id;
	}

	// Scroll-spy: the active section is the first (document order) one that
	// intersects a band near the top of the viewport.
	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const ids = sections.map((s) => s.id);
		const visible: Record<string, boolean> = {};
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					visible[entry.target.id] = entry.isIntersecting;
				}
				const first = ids.find((id) => visible[id]);
				if (first) activeId = first;
			},
			{ rootMargin: '-15% 0px -70% 0px' }
		);
		for (const id of ids) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
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
	</ul>
</nav>
