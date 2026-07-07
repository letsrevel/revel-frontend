<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { GuestTicketFormData } from '$lib/schemas/guestAttendance';

	interface Props {
		formData: GuestTicketFormData;
		fieldErrors: Record<string, string>;
		isSubmitting: boolean;
		onKeydown: (e: KeyboardEvent) => void;
		onBlur: (field: string) => void;
	}

	let { formData = $bindable(), fieldErrors, isSubmitting, onKeydown, onBlur }: Props = $props();
</script>

<!-- Email Field -->
<div class="space-y-2">
	<Label for="guest-ticket-email">{m['guest_attendance.email_label']()}</Label>
	<Input
		id="guest-ticket-email"
		type="email"
		bind:value={formData.email}
		onkeydown={onKeydown}
		onblur={() => onBlur('email')}
		placeholder={m['guest_attendance.email_placeholder']()}
		disabled={isSubmitting}
		aria-invalid={fieldErrors.email ? 'true' : 'false'}
		aria-describedby={fieldErrors.email
			? 'ticket-email-error ticket-email-hint'
			: 'ticket-email-hint'}
		autocomplete="email"
		required
	/>
	<p id="ticket-email-hint" class="text-xs text-muted-foreground">
		{m['guest_attendance.email_hint']()}
	</p>
	{#if fieldErrors.email}
		<p id="ticket-email-error" class="text-sm text-destructive" role="alert">
			{fieldErrors.email}
		</p>
	{/if}
</div>

<!-- First Name and Last Name -->
<div class="grid gap-4 sm:grid-cols-2">
	<div class="space-y-2">
		<Label for="guest-ticket-first-name">{m['guest_attendance.first_name_label']()}</Label>
		<Input
			id="guest-ticket-first-name"
			type="text"
			bind:value={formData.first_name}
			onkeydown={onKeydown}
			onblur={() => onBlur('first_name')}
			placeholder={m['guest_attendance.first_name_placeholder']()}
			disabled={isSubmitting}
			aria-invalid={fieldErrors.first_name ? 'true' : 'false'}
			aria-describedby={fieldErrors.first_name ? 'ticket-first-name-error' : undefined}
			autocomplete="given-name"
			required
		/>
		{#if fieldErrors.first_name}
			<p id="ticket-first-name-error" class="text-sm text-destructive" role="alert">
				{fieldErrors.first_name}
			</p>
		{/if}
	</div>

	<div class="space-y-2">
		<Label for="guest-ticket-last-name">{m['guest_attendance.last_name_label']()}</Label>
		<Input
			id="guest-ticket-last-name"
			type="text"
			bind:value={formData.last_name}
			onkeydown={onKeydown}
			onblur={() => onBlur('last_name')}
			placeholder={m['guest_attendance.last_name_placeholder']()}
			disabled={isSubmitting}
			aria-invalid={fieldErrors.last_name ? 'true' : 'false'}
			aria-describedby={fieldErrors.last_name ? 'ticket-last-name-error' : undefined}
			autocomplete="family-name"
			required
		/>
		{#if fieldErrors.last_name}
			<p id="ticket-last-name-error" class="text-sm text-destructive" role="alert">
				{fieldErrors.last_name}
			</p>
		{/if}
	</div>
</div>
