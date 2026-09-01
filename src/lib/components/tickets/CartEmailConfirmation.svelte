<script lang="ts">
	/** Standalone confirmation dialog for the guest cart checkout's `message`
	 * branch (#853 PR 4): the backend emailed a confirm link and there is no
	 * ticket to show yet. Ported from the legacy `GuestTicketSuccess`
	 * (events/), which rendered as a content-swap INSIDE `GuestTicketDialog`'s
	 * own `<Dialog>` (reusing its always-on header); this is now a fully
	 * separate dialog the page mounts after the checkout sheet closes (Task
	 * 5), so it owns its own `Dialog`/`DialogTitle`/`DialogDescription` for
	 * a11y instead of a bare heading. */
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { CheckCircle2 } from '@lucide/svelte';

	interface Props {
		open: boolean;
		/** Address the confirmation link was sent to. */
		email: string;
		/** Close/back affordance — the page clears its own "pending" state here. */
		onClose: () => void;
	}

	let { open = $bindable(), email, onClose }: Props = $props();
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader class="items-center text-center">
			<div class="rounded-full bg-primary/10 p-3">
				<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
			</div>
			<DialogTitle>{m['guest_attendance.ticket_email_sent_title']()}</DialogTitle>
			<DialogDescription>
				{m['guest_attendance.ticket_email_sent_body']({ email })}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button onclick={onClose} class="w-full">
				{m['guest_attendance.common_close']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
