<script lang="ts">
	/** Buyer identity for an unauthenticated checkout (#853 PR 4): email
	 * always; first/last name only when the event requires ticket names
	 * (mirrors `GuestNameInputs`' per-ticket-holder gate, applied here to the
	 * BUYER's own name). Ported from the legacy `GuestTicketIdentityFields`
	 * (events/) — dropped its fieldErrors/onBlur/onKeydown props: the sheet's
	 * submit gate is the disabled-confirm-button + footer-hint pattern used
	 * everywhere else in `CheckoutSheet` (no per-field inline alerts), so
	 * there is nothing for this component to report inline. Writes go
	 * straight into the bound `GuestIdentity` store. */
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { GuestIdentity } from './guest-identity.svelte';

	interface Props {
		identity: GuestIdentity;
		/** Show/require first + last name — mirrors the event's require_ticket_names. */
		requireTicketNames: boolean;
		isProcessing: boolean;
		/** Prefixes every input/label id so this can't collide with another instance. */
		idPrefix: string;
	}

	const { identity, requireTicketNames, isProcessing, idPrefix }: Props = $props();
</script>

<div class="space-y-4">
	<div class="space-y-2">
		<Label for="{idPrefix}-email">{m['guest_attendance.email_label']()}</Label>
		<Input
			id="{idPrefix}-email"
			type="email"
			bind:value={identity.email}
			placeholder={m['guest_attendance.email_placeholder']()}
			disabled={isProcessing}
			aria-describedby="{idPrefix}-email-hint"
			autocomplete="email"
			required
		/>
		<p id="{idPrefix}-email-hint" class="text-xs text-muted-foreground">
			{m['guest_attendance.email_hint']()}
		</p>
	</div>

	{#if requireTicketNames}
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<Label for="{idPrefix}-first-name">{m['guest_attendance.first_name_label']()}</Label>
				<Input
					id="{idPrefix}-first-name"
					type="text"
					bind:value={identity.firstName}
					placeholder={m['guest_attendance.first_name_placeholder']()}
					disabled={isProcessing}
					autocomplete="given-name"
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="{idPrefix}-last-name">{m['guest_attendance.last_name_label']()}</Label>
				<Input
					id="{idPrefix}-last-name"
					type="text"
					bind:value={identity.lastName}
					placeholder={m['guest_attendance.last_name_placeholder']()}
					disabled={isProcessing}
					autocomplete="family-name"
					required
				/>
			</div>
		</div>
	{/if}
</div>
