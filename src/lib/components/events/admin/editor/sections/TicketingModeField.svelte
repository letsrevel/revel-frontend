<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Ticket } from '@lucide/svelte';

	interface Props {
		requiresTicket: boolean;
		/** True once the event exists: the mode can no longer change, so it reads as a statement. */
		locked: boolean;
		onChange: (requiresTicket: boolean) => void;
	}

	const { requiresTicket, locked, onChange }: Props = $props();
</script>

<div class="space-y-3">
	<p class="flex items-center gap-2 text-sm font-medium">
		<Ticket class="h-4 w-4" aria-hidden="true" />
		{m['essentialsStep.ticketing']()}
	</p>

	{#if locked}
		<p class="text-sm" data-testid="ticketing-mode-statement">
			<span class="font-semibold">
				{requiresTicket ? m['eventEditor.glanceTickets']() : m['eventEditor.glanceRsvp']()}
			</span>
			<span class="text-muted-foreground">
				· {requiresTicket
					? m['eventEditor.ticketingModeTickets']()
					: m['eventEditor.ticketingModeRsvp']()}
			</span>
		</p>
		<p class="text-xs text-muted-foreground">
			{m['essentialsStep.ticketingImmutableEditWarning']()}
		</p>
	{:else}
		<!-- Immutability warning: always visible while the choice is still open -->
		<div
			class="rounded-md border border-highlight bg-highlight/10 px-3 py-2.5 text-sm"
			role="alert"
		>
			<div class="flex items-start gap-2">
				<span class="text-highlight-foreground dark:text-highlight" aria-hidden="true">⚠️</span>
				<div class="flex-1 text-foreground">
					<p class="font-medium">{m['essentialsStep.ticketingImmutableWarning']()}</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['essentialsStep.ticketingImmutableHint']()}
					</p>
				</div>
			</div>
		</div>

		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={requiresTicket}
				onchange={(e) => onChange(e.currentTarget.checked)}
				class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">{m['essentialsStep.requiresTicket']()}</div>
				<div class="text-sm text-muted-foreground">
					{m['essentialsStep.requiresTicketDescription']()}
				</div>
			</div>
		</label>

		<div class="rounded-md bg-muted p-3 text-sm">
			<p class="font-medium text-foreground">{m['essentialsStep.whatsTheDifference']()}</p>
			<ul class="mt-2 space-y-1.5 text-xs text-muted-foreground">
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['essentialsStep.withTicketsLabel']()}</strong>
						{m['essentialsStep.withTicketsDescription']()}</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['essentialsStep.withoutTicketsLabel']()}</strong>
						{m['essentialsStep.withoutTicketsDescription']()}</span
					>
				</li>
			</ul>
		</div>
	{/if}
</div>
