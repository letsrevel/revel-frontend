<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';
	import CalendarDayPicker from './CalendarDayPicker.svelte';
	import type { RegisterFilters } from '$lib/member-register/filters';
	import { hasExtraFilters } from '$lib/member-register/people-view';
	import { SELECT_CLASS } from '$lib/member-register/ui';

	interface Props {
		filters: RegisterFilters;
		/** All-kinds tier list (standard and temporary). */
		tiers: MembershipTierSchema[];
		timezone: string | null;
		/** Receives PATCHES, never full objects built from the (possibly lagging) props. */
		onChange: (patch: Partial<RegisterFilters>) => void;
	}

	const { filters, tiers, timezone, onChange }: Props = $props();

	const SEARCH_DEBOUNCE_MS = 300;

	let searchInput = $state(untrack(() => filters.search));
	// The last search value this component emitted (or mirrored from outside).
	let lastEmitted = untrack(() => filters.search);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Mirror the intended search into the box only when the change did NOT
	// originate here (back/forward, clear-all elsewhere). Our own emissions are
	// already in the box, and intermediate navigation settles never touch it.
	$effect(() => {
		const external = filters.search;
		if (external !== lastEmitted) {
			lastEmitted = external;
			searchInput = external;
			// The typed text is superseded by the external change.
			clearTimeout(timer);
		}
	});

	$effect(() => () => clearTimeout(timer));

	function handleSearchInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const next = searchInput.trim();
			if (next === lastEmitted) return;
			lastEmitted = next;
			onChange({ search: next, page: 1 });
		}, SEARCH_DEBOUNCE_MS);
	}

	function update(patch: Partial<RegisterFilters>) {
		onChange({ ...patch, page: 1 });
	}

	function clearAll() {
		clearTimeout(timer);
		lastEmitted = '';
		searchInput = '';
		// The group chip is not ours to reset: only search, tier and day.
		onChange({ search: '', tierId: null, activeOn: null, page: 1 });
	}
</script>

<form
	role="search"
	aria-label={m['memberRegister.filtersLabel']()}
	class="space-y-4 rounded-lg border border-border bg-card p-4"
	onsubmit={(e) => e.preventDefault()}
>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<Label for="register-search">{m['memberRegister.searchLabel']()}</Label>
			<div class="relative mt-2">
				<Search
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="register-search"
					type="search"
					class="pl-9"
					placeholder={m['memberRegister.searchPlaceholder']()}
					bind:value={searchInput}
					oninput={handleSearchInput}
				/>
			</div>
		</div>

		<div>
			<Label for="register-tier">{m['memberRegister.tierLabel']()}</Label>
			<select
				id="register-tier"
				class="{SELECT_CLASS} mt-2"
				value={filters.tierId ?? ''}
				onchange={(e) => update({ tierId: e.currentTarget.value || null })}
			>
				<option value="">{m['memberRegister.tierAll']()}</option>
				{#each tiers as tier (tier.id ?? tier.name)}
					{#if tier.id}
						<option value={tier.id}>
							{tier.kind === 'temporary'
								? m['memberRegister.tierOptionDay']({ name: tier.name })
								: tier.name}
						</option>
					{/if}
				{/each}
			</select>
		</div>

		<CalendarDayPicker
			id="register-active-on"
			class="sm:col-span-2"
			label={m['memberPeople.asOfLabel']()}
			value={filters.activeOn ?? ''}
			{timezone}
			onChange={(day) => onChange({ activeOn: day || null, page: 1 })}
		/>
	</div>

	{#if hasExtraFilters(filters)}
		<Button type="button" variant="ghost" size="sm" onclick={clearAll}>
			<X aria-hidden="true" />
			{m['memberRegister.clearFilters']()}
		</Button>
	{/if}
</form>
