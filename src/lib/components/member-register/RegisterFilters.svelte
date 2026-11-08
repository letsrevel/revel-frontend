<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';
	import CalendarDayPicker from './CalendarDayPicker.svelte';
	import {
		DEFAULT_FILTERS,
		hasActiveFilters,
		type AccountFilter,
		type OpenFilter,
		type RegisterFilters
	} from '$lib/member-register/filters';
	import { SELECT_CLASS } from '$lib/member-register/ui';

	interface Props {
		filters: RegisterFilters;
		/** All-kinds tier list (standard and temporary). */
		tiers: MembershipTierSchema[];
		timezone: string | null;
		onChange: (next: RegisterFilters, opts?: { replace?: boolean }) => void;
	}

	const { filters, tiers, timezone, onChange }: Props = $props();

	const SEARCH_DEBOUNCE_MS = 300;

	let searchInput = $state(untrack(() => filters.search));
	let lastApplied = untrack(() => filters.search);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Back/forward navigation changes the URL filters from outside: mirror them.
	$effect(() => {
		const external = filters.search;
		if (external !== lastApplied) {
			lastApplied = external;
			searchInput = external;
		}
	});

	$effect(() => () => clearTimeout(timer));

	function handleSearchInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const next = searchInput.trim();
			if (next === lastApplied) return;
			lastApplied = next;
			onChange({ ...filters, search: next, page: 1 }, { replace: true });
		}, SEARCH_DEBOUNCE_MS);
	}

	function update(patch: Partial<RegisterFilters>) {
		onChange({ ...filters, ...patch, page: 1 });
	}

	function clearAll() {
		clearTimeout(timer);
		lastApplied = '';
		searchInput = '';
		onChange({ ...DEFAULT_FILTERS });
	}
</script>

<form
	role="search"
	aria-label={m['memberRegister.filtersLabel']()}
	class="space-y-4 rounded-lg border border-border bg-card p-4"
	onsubmit={(e) => e.preventDefault()}
>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="sm:col-span-2">
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
			<Label for="register-kind">{m['memberRegister.kindLabel']()}</Label>
			<select
				id="register-kind"
				class="{SELECT_CLASS} mt-2"
				value={filters.kind ?? ''}
				onchange={(e) => {
					const v = e.currentTarget.value;
					update({ kind: v === 'standard' || v === 'temporary' ? v : null });
				}}
			>
				<option value="">{m['memberRegister.kindAll']()}</option>
				<option value="standard">{m['memberRegister.kindStandard']()}</option>
				<option value="temporary">{m['memberRegister.kindTemporary']()}</option>
			</select>
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

		<div>
			<Label for="register-open">{m['memberRegister.statusLabel']()}</Label>
			<select
				id="register-open"
				class="{SELECT_CLASS} mt-2"
				value={filters.open}
				onchange={(e) => update({ open: e.currentTarget.value as OpenFilter })}
			>
				<option value="all">{m['memberRegister.statusAll']()}</option>
				<option value="open">{m['memberRegister.statusOpen']()}</option>
				<option value="closed">{m['memberRegister.statusClosed']()}</option>
			</select>
		</div>

		<div>
			<Label for="register-account">{m['memberRegister.accountLabel']()}</Label>
			<select
				id="register-account"
				class="{SELECT_CLASS} mt-2"
				value={filters.account}
				onchange={(e) => update({ account: e.currentTarget.value as AccountFilter })}
			>
				<option value="all">{m['memberRegister.accountAll']()}</option>
				<option value="with">{m['memberRegister.accountWith']()}</option>
				<option value="without">{m['memberRegister.accountWithout']()}</option>
			</select>
		</div>

		<CalendarDayPicker
			id="register-active-on"
			class="sm:col-span-2"
			label={m['memberRegister.dayLabel']()}
			value={filters.activeOn ?? ''}
			{timezone}
			onChange={(day) => update({ activeOn: day || null })}
		/>
	</div>

	{#if hasActiveFilters(filters)}
		<Button type="button" variant="ghost" size="sm" onclick={clearAll}>
			<X aria-hidden="true" />
			{m['memberRegister.clearFilters']()}
		</Button>
	{/if}
</form>
