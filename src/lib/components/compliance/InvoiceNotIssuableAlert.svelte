<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle } from '@lucide/svelte';

	/**
	 * A draft attendee invoice the country rules no longer let Revel issue
	 * (#1001, 422 on issue). `detail` is the backend's translated reason; the
	 * helper line says what to do instead.
	 */
	interface Props {
		detail: string;
	}

	const { detail }: Props = $props();
</script>

<div
	class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
	role="alert"
	data-testid="invoice-not-issuable"
>
	<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
	<div class="space-y-1">
		<p>{detail}</p>
		<p class="font-medium">{m['compliance.invoicing.draftNotIssuable']()}</p>
	</div>
</div>
