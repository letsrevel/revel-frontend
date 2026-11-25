<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

	/**
	 * Studio-volume hint for a ticket, RSVP or invitation holder whose account was
	 * erased (backend #1509): the row stays valid under the kept holder name and
	 * email, but there is no profile behind it.
	 */
	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();
</script>

<span class="inline-flex {className}">
	<StatusBadge
		tone="neutral"
		size="sm"
		label={m['erasedHolder.badge']()}
		data-testid="erased-holder-badge"
	/>
</span>
