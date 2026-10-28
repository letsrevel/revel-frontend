<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Ticket } from '@lucide/svelte';
	import RadioTileGroup from './RadioTileGroup.svelte';

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
		<RadioTileGroup
			name="requires_ticket"
			ariaLabel={m['essentialsStep.ticketing']()}
			value={requiresTicket ? 'tickets' : 'rsvp'}
			options={[
				{
					value: 'rsvp',
					title: m['eventEditor.glanceRsvp'](),
					description: m['essentialsStep.withoutTicketsDescription']()
				},
				{
					value: 'tickets',
					title: m['eventEditor.glanceTickets'](),
					description: m['essentialsStep.withTicketsDescription']()
				}
			]}
			onSelect={(v) => onChange(v === 'tickets')}
		/>
		<p class="text-xs text-muted-foreground">
			{m['essentialsStep.ticketingImmutableEditWarning']()}
		</p>
	{/if}
</div>
