<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle } from '@lucide/svelte';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';

	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();
</script>

<!-- Pending tickets deliberately keep their downloads/wallet passes (the
     offline pay-at-the-door flow needs them, and pending emails no longer
     attach files) — but the artifacts carry no pending marker of their own,
     so this adjacent label is the only signal. Compact pill; the full
     explanation lives in the tooltip, with an sr-only copy so screen
     readers get it without hover. Highlight recipe audited in
     scripts/audit-brand-themes.py ("MyTicket warning banner" over --card,
     "MyTicketModal warning banner" over --background): valid on both. -->
<TooltipProvider>
	<Tooltip>
		<TooltipTrigger
			type="button"
			class="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-highlight/40 bg-highlight/20 px-2.5 py-1 text-xs font-bold text-highlight-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-highlight {className}"
		>
			<AlertCircle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			{m['ticketDownloads.pendingNotice']()}
			<span class="sr-only">{m['ticketDownloads.pendingNoticeDetail']()}</span>
		</TooltipTrigger>
		<TooltipContent>
			<p class="max-w-xs text-sm">{m['ticketDownloads.pendingNoticeDetail']()}</p>
		</TooltipContent>
	</Tooltip>
</TooltipProvider>
