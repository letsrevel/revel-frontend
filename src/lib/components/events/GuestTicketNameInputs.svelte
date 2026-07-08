<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { User } from '@lucide/svelte';

	interface Props {
		guestNames: string[];
		firstName: string;
		lastName: string;
		isSubmitting: boolean;
		guestNameError: string;
		onUpdateName: (index: number, value: string) => void;
	}

	const { guestNames, firstName, lastName, isSubmitting, guestNameError, onUpdateName }: Props =
		$props();
</script>

<div class="space-y-3">
	<div class="flex items-center gap-2">
		<User class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<Label class="text-base font-semibold">{m['guestTicketDialog.ticketHolderNames']()}</Label>
	</div>
	<p class="text-sm text-muted-foreground">
		{m['guestTicketDialog.ticketHolderNamesHint']()}
	</p>
	<div class="space-y-3">
		{#each guestNames as name, index (index)}
			<div class="space-y-2">
				<Label for="guest-name-{index}">
					{index === 0
						? m['guestTicketDialog.yourName']()
						: m['guestTicketDialog.guestName']({ number: index + 1 })}
				</Label>
				<Input
					id="guest-name-{index}"
					type="text"
					value={name}
					oninput={(e) => onUpdateName(index, e.currentTarget.value)}
					placeholder={index === 0
						? `${firstName} ${lastName}`.trim() || m['guestTicketDialog.yourNamePlaceholder']()
						: m['guestTicketDialog.guestNamePlaceholder']({ number: index + 1 })}
					disabled={isSubmitting}
					required
				/>
			</div>
		{/each}
		{#if guestNameError}
			<p class="text-sm text-destructive" role="alert">
				{guestNameError}
			</p>
		{/if}
	</div>
</div>
