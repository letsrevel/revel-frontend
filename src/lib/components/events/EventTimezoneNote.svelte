<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Globe } from 'lucide-svelte';

	interface Props {
		/** Optional extra classes for layout tuning by the host. */
		class?: string;
	}

	const { class: className = '' }: Props = $props();
</script>

<p class="inline-flex items-center gap-1.5 text-xs text-muted-foreground {className}">
	<Globe class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
	<span>{m['eventTime.timezoneNote']()}</span>
</p>
