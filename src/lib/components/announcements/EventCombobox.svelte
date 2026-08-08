<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
	import { Input } from '$lib/components/ui/input';
	import { Loader2, Search, X } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';

	export type EventChoice = { id: string; name: string };

	interface Props {
		/** Organization whose events are offered. */
		organizationSlug: string;
		/** Currently selected event id, or `null`. */
		value: string | null;
		/**
		 * Display name for `value`. Required to keep the field readable when the
		 * selected event is NOT in the current (searched, paginated) result page —
		 * e.g. editing an announcement that targets an event 300 rows down.
		 */
		valueLabel?: string | null;
		onSelect: (choice: EventChoice | null) => void;
		/** Widen the search to past events as well as upcoming ones. */
		includePast?: boolean;
		disabled?: boolean;
		/** Applied to the search input so an external `<label for>` can target it. */
		id?: string;
		invalid?: boolean;
		/** Extra element id appended to the input's `aria-describedby`. */
		describedBy?: string;
	}

	const {
		organizationSlug,
		value,
		valueLabel = null,
		onSelect,
		includePast = false,
		disabled = false,
		id,
		invalid = false,
		describedBy
	}: Props = $props();

	// One `$props.id()` per component instance is all Svelte allows; derive the
	// rest of the ids from it.
	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const hintId = `${uid}-hint`;

	/**
	 * Text in the field. Mirrors the selected event's name while the list is
	 * closed — seeded by the sync effect below, which also runs on mount.
	 */
	let query = $state('');
	let debounced = $state('');
	let open = $state(false);
	let activeIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let blurTimer: ReturnType<typeof setTimeout> | undefined;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// The selected label is owned by the parent — the composer knows it from
	// `announcement.event_name` when editing a draft whose event is nowhere near
	// the first page of results. Re-sync the field whenever it changes, but never
	// while the list is open, which would fight the user's typing.
	$effect(() => {
		const label = valueLabel ?? '';
		if (!open) {
			query = label;
		}
	});

	$effect(() => {
		clearTimeout(debounceTimer);
		const q = query;
		debounceTimer = setTimeout(() => {
			debounced = q.trim();
		}, 250);
		return () => clearTimeout(debounceTimer);
	});

	// Searching for the label of the already-selected event is noise: the field
	// shows that name whenever the user has not typed anything new, and sending
	// it as `search` would narrow the list down to the single row already picked.
	const searchTerm = $derived(debounced === (valueLabel ?? '').trim() ? '' : debounced);

	const eventsQuery = createQuery(() => ({
		queryKey: ['announcement-event-picker', organizationSlug, includePast, searchTerm],
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					organization_slug: organizationSlug,
					search: searchTerm || undefined,
					include_past: includePast,
					// The endpoint accepts 'start' | '-start' | 'distance'. Upcoming-only
					// reads best soonest-first; once past events join the list, ascending
					// `start` would bury every live event under years of history, so flip
					// to newest-first there.
					order_by: includePast ? '-start' : 'start',
					page_size: 20
				}
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: open
	}));

	const results = $derived(eventsQuery.data?.results ?? []);
	const isFetching = $derived(eventsQuery.isFetching);
	/** An empty answer to an unfiltered question — nothing was searched away. */
	const emptyUnfiltered = $derived(
		!isFetching && eventsQuery.isSuccess && results.length === 0 && searchTerm === ''
	);
	/**
	 * No events at all in this organization. Only an `include_past` search can
	 * support that claim: server-side the endpoint sets `next_events = !include_past`,
	 * so with past events excluded an org whose every event has already happened
	 * answers "zero" too — and telling its admin to "create an event first" would
	 * be plainly false.
	 */
	const orgHasNoEvents = $derived(emptyUnfiltered && includePast);
	/** Events may well exist, just none of them ahead of now. */
	const orgHasNoUpcomingEvents = $derived(emptyUnfiltered && !includePast);

	function optionId(index: number): string {
		return `${listboxId}-option-${index}`;
	}

	// Keep the active option scrolled into the listbox, and the listbox itself
	// inside whatever is scrolling around us. This list is deliberately NOT
	// portalled — it has to stay inside the composer dialog's focus trap — so it
	// is an absolutely positioned descendant of that dialog's `overflow-y-auto`
	// content box, which clips it (same constraint as MemberCombobox, #702).
	$effect(() => {
		if (!open) return;
		const index = activeIndex;
		// `scrollIntoView` is unimplemented in jsdom and this is a pure viewport
		// nicety, hence the optional calls.
		if (index < 0) {
			listEl?.scrollIntoView?.({ block: 'nearest' });
			return;
		}
		const option = listEl?.children[index];
		(option as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
	});

	function openList() {
		if (disabled) return;
		// Focus moving back INTO the component cancels the pending close: without
		// this, tabbing input → clear button → back leaves a 150ms-old timer that
		// slams the list shut again for no reason the user can see.
		clearTimeout(blurTimer);
		open = true;
	}

	function closeList() {
		open = false;
		activeIndex = -1;
	}

	function pick(index: number) {
		const event = results[index];
		if (!event) return;
		onSelect({ id: event.id, name: event.name });
		query = event.name;
		closeList();
	}

	function clearSelection() {
		clearTimeout(blurTimer);
		onSelect(null);
		query = '';
		debounced = '';
		activeIndex = -1;
		inputEl?.focus();
		open = true;
	}

	function move(delta: number) {
		if (results.length === 0) return;
		const next = activeIndex + delta;
		activeIndex = next < 0 ? results.length - 1 : next >= results.length ? 0 : next;
	}

	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) {
					openList();
					return;
				}
				move(1);
				return;
			case 'ArrowUp':
				event.preventDefault();
				if (!open) {
					openList();
					return;
				}
				move(-1);
				return;
			case 'Home':
				if (!open || results.length === 0) return;
				event.preventDefault();
				activeIndex = 0;
				return;
			case 'End':
				if (!open || results.length === 0) return;
				event.preventDefault();
				activeIndex = results.length - 1;
				return;
			case 'Enter':
				// Swallow Enter only when it actually commits a highlighted option.
				// ARIA APG defines Enter for an editable combobox solely for the case
				// where "an autocomplete suggestion is selected in the popup"; with
				// nothing highlighted the key has no combobox meaning, so it must keep
				// its default action instead of dying silently. That default is the
				// composer <form>'s implicit submit (save draft), exactly as it was
				// with the <select> this replaced. Harmless: `query` is display-only —
				// the selection lives in the parent's `selectedEventId` — so leftover
				// search text cannot reach the submitted payload.
				if (!open || activeIndex < 0) return;
				event.preventDefault();
				pick(activeIndex);
				return;
			case 'Escape':
				if (!open) return;
				// The composer is a bits-ui Dialog — an un-stopped Escape closes the
				// whole dialog and the half-written announcement with it.
				event.preventDefault();
				event.stopPropagation();
				closeList();
				return;
			case 'Tab':
				closeList();
		}
	}
</script>

<div class="relative">
	<div class="relative">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			bind:ref={inputEl}
			{id}
			type="text"
			autocomplete="off"
			bind:value={query}
			{disabled}
			placeholder={m['announcements.form.eventSearchPlaceholder']()}
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={open ? listboxId : undefined}
			aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
			aria-invalid={invalid || undefined}
			aria-describedby={describedBy ? `${hintId} ${describedBy}` : hintId}
			class="pl-9 {value ? 'pr-10' : ''} {invalid ? 'border-destructive' : ''}"
			onfocus={openList}
			onclick={openList}
			oninput={() => {
				open = true;
				activeIndex = -1;
			}}
			onkeydown={handleKeydown}
			onblur={() => {
				clearTimeout(blurTimer);
				// Let a mousedown on an option land before the list disappears.
				blurTimer = setTimeout(() => {
					closeList();
					query = valueLabel ?? '';
				}, 150);
			}}
		/>
		{#if value && !disabled}
			<button
				type="button"
				onclick={clearSelection}
				class="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<X class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m['announcements.form.clearEventSelection']()}</span>
			</button>
		{/if}
	</div>

	<p id={hintId} class="sr-only">{m['announcements.form.eventSearchHint']()}</p>

	<!-- Result count for screen readers; the visible list says it for everyone else. -->
	<p role="status" class="sr-only">
		{#if open && !isFetching}
			{m['announcements.form.eventResultsCount']({ count: results.length })}
		{/if}
	</p>

	{#if open}
		<!-- Height: 15rem where there is room, but never more than 40% of a short
		     viewport — on a phone with the software keyboard up a fixed 15rem list
		     is taller than the space left below the input. -->
		<div
			class="absolute z-50 mt-1 max-h-[min(15rem,40vh)] w-full overflow-y-auto rounded-md border bg-popover shadow-lg"
		>
			{#if results.length === 0}
				<div class="px-3 py-3 text-sm text-muted-foreground">
					{#if isFetching}
						<span class="flex items-center gap-2">
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							{m['announcements.form.loadingEvents']()}
						</span>
					{:else if orgHasNoEvents}
						<span class="block font-medium">{m['announcements.form.noEvents']()}</span>
						<span class="mt-1 block text-xs">{m['announcements.form.noEventsDescription']()}</span>
					{:else if orgHasNoUpcomingEvents}
						<span class="block font-medium">{m['announcements.form.noUpcomingEvents']()}</span>
						<span class="mt-1 block text-xs"
							>{m['announcements.form.noUpcomingEventsDescription']()}</span
						>
					{:else}
						{m['announcements.form.noEventsMatch']()}
					{/if}
				</div>
			{/if}
			<ul
				bind:this={listEl}
				id={listboxId}
				role="listbox"
				aria-label={m['announcements.form.selectEvent']()}
			>
				{#each results as event, index (event.id)}
					<li
						id={optionId(index)}
						role="option"
						aria-selected={value === event.id}
						tabindex="-1"
						class="cursor-pointer px-3 py-2 text-sm {index === activeIndex
							? 'bg-accent text-accent-foreground'
							: ''}"
						onmousedown={(e) => {
							e.preventDefault();
							pick(index);
						}}
						onmouseenter={() => (activeIndex = index)}
					>
						<div class="truncate font-medium">{event.name}</div>
						<div class="text-xs text-muted-foreground">{formatDate(event.start)}</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
