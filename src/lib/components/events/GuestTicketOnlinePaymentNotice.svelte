<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { CreditCard } from '@lucide/svelte';
</script>

<Alert>
	<CreditCard class="h-4 w-4" />
	<AlertDescription>
		<p class="text-sm">
			{m['guestTicketDialog.onlinePaymentNotice']()}
		</p>
	</AlertDescription>
</Alert>
