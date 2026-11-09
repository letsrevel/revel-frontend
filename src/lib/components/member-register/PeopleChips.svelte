<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils';
	import { PEOPLE_VIEWS, type PeopleView } from '$lib/member-register/people-view';

	interface Props {
		/** The active chip, or null when the filters match none (legacy links). */
		value: PeopleView | null;
		onChange: (view: PeopleView) => void;
	}

	const { value, onChange }: Props = $props();

	// Static message calls keep the build tree-shakeable.
	function labelFor(view: PeopleView): string {
		switch (view) {
			case 'current':
				return m['memberPeople.view.current']();
			case 'day':
				return m['memberPeople.view.day']();
			case 'ended':
				return m['memberPeople.view.ended']();
			case 'no-account':
				return m['memberPeople.view.noAccount']();
			case 'everyone':
				return m['memberPeople.view.everyone']();
		}
	}
</script>

<!-- Toggle buttons with aria-pressed. The row scrolls sideways on narrow screens
     (the page itself never does); `-mx-4 px-4` lets the chips bleed to the edge. -->
<div
	role="group"
	aria-label={m['memberPeople.view.label']()}
	class="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
	data-testid="people-chips"
>
	{#each PEOPLE_VIEWS as view (view)}
		{@const pressed = value === view}
		<button
			type="button"
			aria-pressed={pressed}
			data-testid="people-chip-{view}"
			class={cn(
				'inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
				pressed
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border bg-card text-foreground hover:bg-muted'
			)}
			onclick={() => onChange(view)}
		>
			{labelFor(view)}
		</button>
	{/each}
</div>
