<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle } from '@lucide/svelte';

	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();
</script>

<!-- Pending tickets deliberately keep their downloads/wallet passes (the
     offline pay-at-the-door flow needs them, and pending emails no longer
     attach files) — but the artifacts carry no pending marker of their own,
     so this adjacent label is the only signal. Highlight recipe audited in
     scripts/audit-brand-themes.py ("MyTicket warning banner" over --card,
     "MyTicketModal warning banner" over --background): valid on both. -->
<div class="rounded-lg border border-highlight/40 bg-highlight/20 p-3 {className}" role="note">
	<p
		class="flex items-start gap-2 text-sm font-medium text-highlight-foreground dark:text-highlight"
	>
		<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
		{m['ticketDownloads.pendingNotice']()}
	</p>
</div>
