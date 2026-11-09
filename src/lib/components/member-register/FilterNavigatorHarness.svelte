<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages.js';
	import RegisterFilters from './RegisterFilters.svelte';
	import { createFilterNavigator } from '$lib/member-register/filter-navigator.svelte';
	import { parseFilters } from '$lib/member-register/filters';

	/** Test harness: the register page's navigator wiring with a controllable `goto`. */
	interface Props {
		goto: (qs: string, opts: { replace: boolean }) => Promise<void>;
	}
	const { goto }: Props = $props();

	let url = $state('');
	const filters = $derived(parseFilters(new URLSearchParams(url)));
	const navigator = createFilterNavigator({
		current: () => filters,
		navigate: async (qs, opts) => {
			await goto(qs, opts);
			url = qs;
		},
		onError: () => toast.error(m['memberRegister.filtersApplyError']())
	});
	const intended = $derived(navigator.intended);
</script>

<RegisterFilters filters={intended} tiers={[]} timezone={null} onChange={navigator.patch} />
<button type="button" onclick={() => navigator.patch({ page: intended.page + 1 }, { push: true })}>
	Next page
</button>
<output data-testid="url">{url}</output>
