<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import { FileText, Ticket, Megaphone } from '@lucide/svelte';

	const tabs = $derived([
		{ value: 'details', label: m['eventEditor.tabDetails'](), icon: FileText },
		{ value: 'ticketing', label: m['eventEditor.tabTicketing'](), icon: Ticket },
		{ value: 'listings', label: m['eventEditor.tabListings'](), icon: Megaphone }
	]);

	// Underline tab bar: reads as page navigation, not a pill toggle. Overrides the
	// shared Tabs primitive's pill styling at the call site.
	const triggerClass =
		'-mb-px gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm sm:px-4 font-semibold text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';
</script>

<Tabs.List
	class="mb-6 h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 [justify-content:flex-start]"
>
	{#each tabs as tab (tab.value)}
		<Tabs.Trigger value={tab.value} class={triggerClass}>
			<tab.icon class="h-4 w-4" aria-hidden="true" />
			{tab.label}
		</Tabs.Trigger>
	{/each}
</Tabs.List>
