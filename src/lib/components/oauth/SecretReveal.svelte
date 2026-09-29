<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ShieldAlert } from '@lucide/svelte';
	import { Alert, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import CopyField from '$lib/components/common/CopyField.svelte';

	interface Props {
		clientId: string;
		/** Lives in the parent's $state only; never in a query or mutation cache. */
		clientSecret: string;
		onDone: () => void;
	}
	const { clientId, clientSecret, onDone }: Props = $props();
</script>

<div class="space-y-4 rounded-2xl border border-border bg-card p-6 text-card-foreground">
	<h2 class="text-xl font-extrabold">{m['oauth.developer.secret.title']()}</h2>
	<Alert variant="warning">
		<ShieldAlert class="h-4 w-4" aria-hidden="true" />
		<AlertTitle>{m['oauth.developer.secret.body']()}</AlertTitle>
	</Alert>
	<div class="space-y-3">
		<div>
			<p class="mb-1 text-sm font-bold">{m['oauth.developer.secret.clientId']()}</p>
			<CopyField value={clientId} label={m['oauth.developer.secret.clientId']()} />
		</div>
		<div>
			<p class="mb-1 text-sm font-bold">{m['oauth.developer.secret.clientSecret']()}</p>
			<CopyField value={clientSecret} label={m['oauth.developer.secret.clientSecret']()} />
		</div>
	</div>
	<Button type="button" onclick={onDone}>{m['oauth.developer.secret.done']()}</Button>
</div>
