<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages.js';
	import RegisterFilters from './RegisterFilters.svelte';
	import PeopleChips from './PeopleChips.svelte';
	import { createFilterNavigator } from '$lib/member-register/filter-navigator.svelte';
	import {
		VIEW_FILTERS,
		parsePeopleFilters,
		peopleFiltersToSearch,
		viewFromFilters
	} from '$lib/member-register/people-view';

	/** Test harness: the People tab's navigator wiring with a controllable `goto`. */
	interface Props {
		goto: (qs: string, opts: { replace: boolean }) => Promise<void>;
	}
	const { goto }: Props = $props();
	const TIER_ID = '0b8b3a52-7a54-4f6b-9a1e-6c5d1f7a3c11';

	let url = $state('');
	const filters = $derived(parsePeopleFilters(new URLSearchParams(url)));
	const navigator = createFilterNavigator({
		current: () => filters,
		serialize: peopleFiltersToSearch,
		navigate: async (qs, opts) => {
			await goto(qs, opts);
			url = qs;
		},
		onError: () => toast.error(m['memberRegister.filtersApplyError']())
	});
	const intended = $derived(navigator.intended);
</script>

<PeopleChips
	value={viewFromFilters(intended)}
	onChange={(view) => navigator.patch({ ...VIEW_FILTERS[view], page: 1 })}
/>
<RegisterFilters
	filters={intended}
	tiers={[{ id: TIER_ID, name: 'Full', kind: 'standard' }]}
	timezone={null}
	onChange={navigator.patch}
/>
<button type="button" onclick={() => navigator.patch({ page: intended.page + 1 }, { push: true })}>
	{m['memberRegister.next']()}
</button>
<output data-testid="url">{url}</output>
