<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { DialogFooter } from '$lib/components/ui/dialog';
	import { CheckCircle2 } from '@lucide/svelte';

	interface Props {
		email: string;
		onClose: () => void;
	}

	const { email, onClose }: Props = $props();
</script>

<!-- Success State (Email Confirmation) -->
<div class="space-y-4 py-6">
	<div class="flex flex-col items-center justify-center space-y-3 text-center">
		<div class="rounded-full bg-primary/10 p-3">
			<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
		</div>
		<div class="space-y-1">
			<h3 class="text-lg font-semibold">{m['guest_attendance.ticket_email_sent_title']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['guest_attendance.ticket_email_sent_body']({ email })}
			</p>
		</div>
	</div>
</div>

<DialogFooter>
	<Button onclick={onClose} class="w-full">
		{m['guest_attendance.common_close']()}
	</Button>
</DialogFooter>
