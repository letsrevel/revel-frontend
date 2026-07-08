<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { CalendarRange } from '@lucide/svelte';
	import type { TicketSeriesPassSchema } from '$lib/api/generated/types.gen';

	interface Props {
		seriesPass: TicketSeriesPassSchema;
		class?: string;
	}

	const { seriesPass, class: className = '' }: Props = $props();
</script>

<span
	class="inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary {className}"
	title={m['seriesPassBadge.tooltip']({ name: seriesPass.name })}
>
	<CalendarRange class="h-3 w-3 shrink-0" aria-hidden="true" />
	{m['seriesPassBadge.label']()}
</span>
